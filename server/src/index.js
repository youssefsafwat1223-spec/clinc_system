const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/env');
const prisma = require('./lib/prisma');
const errorHandler = require('./middleware/errorHandler');
const { startReminderCrons } = require('./cron/reminderCron');
const { startExpiryCron } = require('./cron/expiryCron');
const { startReviewCron } = require('./cron/reviewCron');
const { seedSystemTemplates } = require('./lib/seedSystemTemplates');

// Route imports
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const doctorRoutes = require('./routes/doctors');
const appointmentRoutes = require('./routes/appointments');
const messageRoutes = require('./routes/messages');
const serviceRoutes = require('./routes/services');
const settingsRoutes = require('./routes/settings');
const analyticsRoutes = require('./routes/analytics');
const webhookRoutes = require('./routes/webhooks');
const integrationsRoutes = require('./routes/integrations');
const consultationRoutes = require('./routes/consultations');
const campaignRoutes = require('./routes/campaigns');
const prescriptionRoutes = require('./routes/prescriptions');
const notificationsRoutes = require('./routes/notifications');
const uploadRoutes = require('./routes/upload');
const reviewRoutes = require('./routes/reviews');

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.set('trust proxy', 1);

const corsOptions = {
  credentials: true,
};

if (config.nodeEnv === 'production') {
  corsOptions.origin = process.env.DASHBOARD_URL || 'http://localhost:5173';
} else {
  corsOptions.origin = (origin, callback) => callback(null, true);
}

app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(
  express.json({
    limit: '5mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Serve uploaded images statically - Fixed path (src/ to public/ is one level up)
// Using /api/images to ensure Nginx proxies it to the backend correctly
app.use('/api/images', express.static(path.join(__dirname, '../public/images')));
app.use('/api/documents', express.static(path.join(__dirname, '../public/documents')));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/reviews', reviewRoutes);

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({ error: 'الصفحة غير موجودة' });
});

const PORT = config.port;

const startServer = async () => {
  if (config.nodeEnv === 'production' && config.jwtSecret === 'dev-secret-change-me') {
    console.warn('[Security] JWT_SECRET is not set. Please configure a strong secret.');
  }

  app.listen(PORT, async () => {
    console.log(`\nClinic Booking Server running on port ${PORT}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`API: http://localhost:${PORT}/api`);
    console.log(`Health: http://localhost:${PORT}/api/health`);
    console.log('');

    try {
      await prisma.$connect();
      console.log('[DB] Prisma connected successfully');

      try {
        await seedSystemTemplates();
      } catch (seedError) {
        console.error('[Seed] Failed to seed system templates:', seedError.message);
      }

      startReminderCrons();
      startExpiryCron();
      startReviewCron();
    } catch (error) {
      console.error('[DB] Prisma startup connection failed:', error.message);
      console.log('[Cron] Skipped startup because database connection is unavailable');
    }
  });
};

startServer();

module.exports = app;
