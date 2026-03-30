const cron = require('node-cron');
const { expirePendingAppointments } = require('../services/appointmentService');

/**
 * Expiry Cron: Runs every minute to expire stale pending appointments
 */
const startExpiryCron = () => {
  cron.schedule('* * * * *', async () => {
    try {
      await expirePendingAppointments();
    } catch (error) {
      console.error('[Cron] Expiry error:', error);
    }
  });

  console.log('[Cron] Expiry cron started');
};

module.exports = { startExpiryCron };
