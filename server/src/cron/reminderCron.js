const cron = require('node-cron');
const { sendReminders, sendWalkInRemindersBeforeOpening } = require('../services/notificationService');

const startReminderCrons = () => {
  cron.schedule('*/30 * * * *', async () => {
    try {
      console.log('[Cron] Running 1-hour reminder check...');
      const count = await sendReminders(1);
      if (count > 0) {
        console.log(`[Cron] Processed ${count} appointment(s) for 1hr reminder`);
      }
    } catch (error) {
      console.error('[Cron] 1-hour reminder error:', error);
    }
  });

  cron.schedule('0 10 * * *', async () => {
    try {
      console.log('[Cron] Running 24-hour reminder check...');
      const count = await sendReminders(24);
      if (count > 0) {
        console.log(`[Cron] Processed ${count} appointment(s) for 24hr reminder`);
      }
    } catch (error) {
      console.error('[Cron] 24-hour reminder error:', error);
    }
  });

  cron.schedule('*/15 * * * *', async () => {
    try {
      const count = await sendWalkInRemindersBeforeOpening();
      if (count > 0) {
        console.log(`[Cron] Processed ${count} walk-in reminder(s) before opening`);
      }
    } catch (error) {
      console.error('[Cron] Walk-in reminder error:', error);
    }
  });

  console.log('[Cron] Reminder crons started');
};

module.exports = { startReminderCrons };
