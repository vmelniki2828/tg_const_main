const { PERIODS, safeError } = require('./loyaltyService');

function createLoyaltyJobs({ User, Bot, LoyaltyConfig, LoyaltyCheckJob, service, schedule = setImmediate }) {
  async function recover() {
    // Restarting the server must never silently resume a manual award operation.
    await LoyaltyCheckJob.updateMany({ status: 'running' }, { $set: {
      status: 'interrupted', finishedAt: new Date(), error: 'Проверка прервана перезапуском сервера. Можно запустить повторно.'
    } });
  }

  async function run(id, config, upperId) {
    const job = await LoyaltyCheckJob.findById(id).lean();
    if (!job || job.status !== 'running') return;
    job.skipped ||= {};
    let cursor;
    let consecutiveErrors = 0;
    try {
      while (upperId) {
        const state = await LoyaltyCheckJob.findById(id).lean();
        if (state.cancelRequested) {
          job.status = 'cancelled';
          break;
        }
        const users = await User.find({ botId: job.botId,
          _id: { ...(cursor ? { $gt: cursor } : {}), $lte: upperId } }).sort({ _id: 1 }).limit(5).lean();
        if (!users.length) break;
        for (const user of users) {
          const state = await LoyaltyCheckJob.findById(id).lean();
          if (state.status !== 'running') return;
          if (state.cancelRequested) {
            job.status = 'cancelled';
            break;
          }
          config = await LoyaltyConfig.findOne({ botId: job.botId }).lean();
          if (!config?.isEnabled) {
            job.status = 'cancelled';
            job.error = 'Программа лояльности отключена. Проверка остановлена.';
            break;
          }
          job.currentUser = user.userId;
          try {
            const result = await service.checkUser(job.botId, user, config, job.period);
            consecutiveErrors = result.errors ? consecutiveErrors + 1 : 0;
            if (result.status === 'processed') job.processed++;
            else job.skipped[result.status] = (job.skipped[result.status] || 0) + 1;
            job.issued += result.issued;
            job.alreadyIssued += result.alreadyIssued;
            job.noStock += result.noStock;
            job.errorCount += result.errors;
            if (result.error) job.error = result.error;
          } catch (error) {
            job.errorCount++;
            consecutiveErrors++;
            job.error = safeError(error);
          }
          job.checked++;
          cursor = user._id;
          await save(job);
          if (consecutiveErrors >= 3) throw new Error('Три последовательные ошибки Telegram. Проверка остановлена, повторите позже.');
        }
        if (job.status !== 'running') break;
        await new Promise(resolve => setImmediate(resolve));
      }
      if (job.status === 'running') job.status = 'completed';
    } catch (error) {
      job.status = 'failed';
      job.error = consecutiveErrors >= 3 ? error.message : safeError(error);
    }
    job.finishedAt = new Date();
    await save(job);
  }

  async function save(job) {
    const { _id, __v, cancelRequested, ...values } = job;
    await LoyaltyCheckJob.updateOne({ _id }, { $set: values });
  }

  async function start(botId, period) {
    if (period && !PERIODS[period]) throw Object.assign(new Error('Неизвестный период'), { status: 400 });
    await LoyaltyCheckJob.init();
    const existing = await LoyaltyCheckJob.findOne({ botId, status: 'running' }).lean();
    if (existing) return existing;
    const [bot, config] = await Promise.all([Bot.findOne({ id: botId }).lean(), LoyaltyConfig.findOne({ botId }).lean()]);
    if (!bot) throw Object.assign(new Error('Бот не найден'), { status: 404 });
    if (!config?.isEnabled) throw Object.assign(new Error('Программа лояльности отключена'), { status: 400 });
    const last = await User.findOne({ botId }).sort({ _id: -1 }).select('_id').lean();
    const total = last ? await User.countDocuments({ botId, _id: { $lte: last._id } }) : 0;
    let job;
    try {
      job = await LoyaltyCheckJob.create({ botId, period, status: 'running', total });
    } catch (error) {
      if (error.code !== 11000) throw error;
      return LoyaltyCheckJob.findOne({ botId, status: 'running' }).lean();
    }
    schedule(() => run(job._id, config, last?._id).catch(error => console.error('Loyalty job persistence failed:', safeError(error))));
    return job.toObject();
  }

  const latest = botId => LoyaltyCheckJob.findOne({ botId }).sort({ createdAt: -1, _id: -1 }).lean();
  async function cancel(botId) {
    await LoyaltyCheckJob.updateOne({ botId, status: 'running' }, { $set: { cancelRequested: true } });
    return latest(botId);
  }
  return { start, latest, cancel, recover };
}

function registerLoyaltyJobRoutes(app, jobs) {
  const respond = handler => async (req, res) => {
    try { await handler(req, res); }
    catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : safeError(error) }); }
  };
  app.get('/api/loyalty-check/:botId', respond(async (req, res) => res.json({ job: await jobs.latest(req.params.botId) })));
  app.post('/api/loyalty-check/:botId/cancel', respond(async (req, res) => res.json({ job: await jobs.cancel(req.params.botId) })));
  for (const route of ['/api/force-give-loyalty-rewards-all/:botId', '/api/force-give-loyalty-rewards-period/:botId/:period',
    '/api/fix-missed-loyalty-promocodes/:botId', '/api/diagnose-loyalty-mismatch/:botId']) {
    app.post(route, respond(async (req, res) => res.status(202).json({ success: true,
      job: await jobs.start(req.params.botId, req.params.period) })));
  }
}

module.exports = { createLoyaltyJobs, registerLoyaltyJobRoutes };
