const cron = require('node-cron');
const prisma = require('../lib/prisma');

const HUMAN_HANDOVER_TIMEOUT_HOURS = Number(process.env.HUMAN_HANDOVER_TIMEOUT_HOURS || 5);

const revertExpiredHumanHandovers = async () => {
  const cutoff = new Date(Date.now() - HUMAN_HANDOVER_TIMEOUT_HOURS * 60 * 60 * 1000);

  await prisma.patient.updateMany({
    where: {
      chatState: 'HUMAN',
      updatedAt: { lte: cutoff },
    },
    data: { chatState: 'BOT' },
  });
};

const startHumanTimeoutCron = () => {
  cron.schedule('*/10 * * * *', async () => {
    try {
      await revertExpiredHumanHandovers();
    } catch (error) {
      console.error('[Human Timeout Cron] Error:', error.message);
    }
  });
};

module.exports = {
  startHumanTimeoutCron,
  revertExpiredHumanHandovers,
};
