const cron = require('node-cron');
const { sendReminders } = require('../services/notificationService');

/**
 * Reminder Cron Jobs:
 * - Every hour: check for appointments 1 hour away
 * - Daily at 10 AM: check for appointments 24 hours away
 */
const startReminderCrons = () => {
  // 1-hour reminder: runs every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      console.log('[Cron] Running 1-hour reminder check...');
      const count = await sendReminders(1);
      if (count > 0) console.log(`[Cron] Processed ${count} appointment(s) for 1hr reminder`);
    } catch (error) {
      console.error('[Cron] 1-hour reminder error:', error);
    }
  });

  // 24-hour reminder: runs daily at 10 AM
  cron.schedule('0 10 * * *', async () => {
    try {
      console.log('[Cron] Running 24-hour reminder check...');
      const count = await sendReminders(24);
      if (count > 0) console.log(`[Cron] Processed ${count} appointment(s) for 24hr reminder`);
    } catch (error) {
      console.error('[Cron] 24-hour reminder error:', error);
    }
  });

  console.log('[Cron] Reminder crons started');
};

module.exports = { startReminderCrons };
