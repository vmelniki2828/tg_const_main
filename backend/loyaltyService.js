const PERIODS = { '1m': 60000, '24h': 86400000, '7d': 604800000, '30d': 2592000000,
  '90d': 7776000000, '180d': 15552000000, '360d': 31104000000 };

function effectiveTime(user, now = Date.now()) {
  if (!user) return 0;
  const start = new Date(user.loyaltyStartedAt).getTime();
  if (!user.loyaltyStartedAt || !Number.isFinite(start)) return 0;
  const end = !user.isSubscribed && user.lastUnsubscribedAt ? new Date(user.lastUnsubscribedAt).getTime() : now;
  return Math.max(0, end - start - Math.max(0, Number(user.pausedTime) || 0));
}

function normalizeChannel(channel) {
  const value = String(channel || '').trim();
  if (!value) throw new Error('Не указан канал для проверки подписки');
  return /^100\d+$/.test(value) ? `-${value}` : value;
}

function safeError(error) {
  const code = error.response?.error_code || error.code || error.cause?.code || error.name || 'ERROR';
  // Never expose request URLs: they contain the Telegram token.
  return `Ошибка проверки/выдачи (${code})`;
}

function isMember(member) {
  return ['member', 'administrator', 'creator'].includes(member.status) ||
    (member.status === 'restricted' && member.is_member === true);
}

function createLoyaltyService({ User, Loyalty, LoyaltyPromoCode, telegramForBot, now = Date.now }) {
  async function syncFlags(botId, userId, period) {
    await User.updateMany({ botId, userId }, { $set: { [`loyaltyRewards.${period}`]: true } });
    // Historical databases can contain multiple Loyalty records for a user.
    await Loyalty.updateMany({ botId, userId }, { $set: { [`rewards.${period}`]: true } });
    await Loyalty.init();
    try {
      await Loyalty.updateOne({ botId, userId }, { $setOnInsert: { botId, userId, identityKey: JSON.stringify([botId, userId]) },
        $set: { [`rewards.${period}`]: true } }, { upsert: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      await Loyalty.updateMany({ botId, userId }, { $set: { [`rewards.${period}`]: true } });
    }
  }

  async function allocate(botId, userId, period) {
    // Ensure the database enforces one allocation key across all Node processes.
    await LoyaltyPromoCode.init();
    const filter = { botId, period, activatedBy: userId, activated: true };
    let voucher = await LoyaltyPromoCode.findOne(filter).lean();
    let created = false;
    if (!voucher) {
      try {
        voucher = await LoyaltyPromoCode.findOneAndUpdate(
          { botId, period, activated: false },
          { $set: { activated: true, activatedBy: userId, activatedAt: new Date(now()),
            allocationKey: JSON.stringify([botId, userId, period]) } },
          { new: true, sort: { _id: 1 } }
        ).lean();
        created = !!voucher;
      } catch (error) {
        if (error.code !== 11000) throw error;
        voucher = await LoyaltyPromoCode.findOne(filter).lean();
        if (!voucher) throw error;
      }
      // A simultaneous request may have claimed the final available voucher.
      if (!voucher) voucher = await LoyaltyPromoCode.findOne(filter).lean();
    }
    if (!voucher) return 'no_stock';
    // A crash here is recoverable: the voucher is the source of truth on retry.
    await syncFlags(botId, userId, period);
    return created ? 'issued' : 'already_issued';
  }

  async function checkUser(botId, user, config, selectedPeriod) {
    if (selectedPeriod && !PERIODS[selectedPeriod]) throw new Error('Неизвестный период');
    const result = { status: 'processed', issued: 0, alreadyIssued: 0, noStock: 0, errors: 0 };
    if (!config?.isEnabled) return { ...result, status: 'disabled' };
    if (!user.loyaltyStartedAt || !Number.isFinite(new Date(user.loyaltyStartedAt).getTime())) {
      return { ...result, status: 'not_started' };
    }
    const due = Object.keys(PERIODS).filter(period => (!selectedPeriod || selectedPeriod === period) &&
      config.messages?.[period]?.enabled && effectiveTime(user, now()) >= PERIODS[period]);
    if (!due.length) return { ...result, status: 'not_due' };
    if (config.channelSettings?.isRequired) {
      const channel = normalizeChannel(config.channelSettings.channelId);
      const telegram = await telegramForBot(botId);
      let member;
      try {
        member = await telegram.getChatMember(channel, user.userId);
      } catch (error) {
        // Telegram may no longer know a historical member. Skip this user,
        // without changing stored subscription state or hiding channel/API errors.
        if (error.response?.error_code === 400 &&
          ['Bad Request: member not found', 'Bad Request: PARTICIPANT_ID_INVALID']
            .includes(error.response?.description)) {
          return { ...result, status: 'member_unavailable' };
        }
        throw error;
      }
      const subscribed = isMember(member);
      if (!subscribed) return { ...result, status: 'not_subscribed' };
    } else if (!user.isSubscribed) {
      return { ...result, status: 'not_subscribed' };
    }
    // Most passes revisit already issued rewards. Verify the actual allocations
    // once, and avoid writing the same flags for every period on every cycle.
    const [assigned, flags] = await Promise.all([
      LoyaltyPromoCode.find({ botId, activatedBy: user.userId, activated: true, period: { $in: due } })
        .select('period').lean(),
      Loyalty.findOne({ botId, userId: user.userId }).select('rewards').lean()
    ]);
    const assignedPeriods = new Set(assigned.map(voucher => voucher.period));
    for (const period of due) {
      if (assignedPeriods.has(period) && user.loyaltyRewards?.[period] && flags?.rewards?.[period]) {
        result.alreadyIssued++;
        continue;
      }
      try {
        const status = await allocate(botId, user.userId, period);
        if (status === 'issued') result.issued++;
        if (status === 'already_issued') result.alreadyIssued++;
        if (status === 'no_stock') result.noStock++;
      } catch (error) {
        result.errors++;
        result.error = safeError(error);
      }
    }
    return result;
  }
  return { checkUser, allocate };
}

module.exports = { createLoyaltyService, PERIODS, effectiveTime, normalizeChannel, safeError, isMember };
