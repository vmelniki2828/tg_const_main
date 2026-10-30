const { safeError } = require('./loyaltyService');

// Keyset pagination keeps new users/deletions from shifting the current batch.
function createLoyaltySweep({ User, LoyaltyConfig, service, botId, publish, batchSize = 50 }) {
  let running = false;
  let cursor;
  let upperId;
  let progress = { checked: 0, total: 0, status: 'idle', errors: 0 };
  async function runBatch() {
    if (running) return;
    running = true;
    try {
      const config = await LoyaltyConfig.findOne({ botId }).lean();
      if (!config?.isEnabled) { progress.status = 'disabled'; return; }
      const filter = { botId, isSubscribed: true, loyaltyStartedAt: { $ne: null } };
      if (!cursor) {
        const last = await User.findOne(filter).sort({ _id: -1 }).select('_id').lean();
        upperId = last?._id;
        progress = { checked: 0, total: upperId ? await User.countDocuments({ ...filter, _id: { $lte: upperId } }) : 0,
          status: 'running', errors: 0 };
      }
      const users = upperId ? await User.find({ ...filter, _id: { ...(cursor ? { $gt: cursor } : {}), $lte: upperId } })
        .sort({ _id: 1 }).limit(batchSize).lean() : [];
      for (const user of users) {
        try {
          const result = await service.checkUser(botId, user, config);
          progress.errors += result.errors;
        } catch (error) {
          progress.errors++;
          progress.error = safeError(error);
        }
        cursor = user._id;
        progress.checked++;
        progress.currentUser = user.userId;
        publish({ ...progress });
      }
      if (users.length < batchSize || progress.checked >= progress.total) {
        cursor = undefined;
        progress.status = 'completed';
      }
    } catch (error) {
      progress.status = 'error'; progress.error = safeError(error);
    } finally { running = false; publish({ ...progress }); }
  }
  return { runBatch };
}
module.exports = { createLoyaltySweep };
