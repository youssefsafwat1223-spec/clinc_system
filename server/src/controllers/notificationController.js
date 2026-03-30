const prisma = require('../lib/prisma');

const getScopedDoctor = async (req) => {
  if (req.user?.role !== 'DOCTOR') {
    return null;
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: req.user.id },
    select: { id: true, name: true },
  });

  if (!doctor) {
    const error = new Error('لا يوجد ملف طبيب مرتبط بهذا الحساب');
    error.status = 403;
    throw error;
  }

  return doctor;
};

const getDoctorPatientIds = async (doctorId) => {
  const [appointments, consultations, prescriptions] = await Promise.all([
    prisma.appointment.findMany({
      where: { doctorId },
      select: { patientId: true },
      distinct: ['patientId'],
    }),
    prisma.consultation.findMany({
      where: { doctorId },
      select: { patientId: true },
      distinct: ['patientId'],
    }),
    prisma.prescription.findMany({
      where: { doctorId },
      select: { patientId: true },
      distinct: ['patientId'],
    }),
  ]);

  return [...new Set([...appointments, ...consultations, ...prescriptions].map((item) => item.patientId))];
};

const parseNotificationLink = (link) => {
  try {
    const url = new URL(link || '/', 'http://localhost');
    return {
      doctorId: url.searchParams.get('doctorId'),
      patientId: url.searchParams.get('patientId'),
      appointmentId: url.searchParams.get('appointmentId'),
    };
  } catch {
    return { doctorId: null, patientId: null, appointmentId: null };
  }
};

const canDoctorAccessNotification = (notification, scopedDoctor, patientIds) => {
  if (notification.type === 'CONSULTATION_REQUEST') {
    return true;
  }

  const { doctorId, patientId } = parseNotificationLink(notification.link);

  if (doctorId) {
    return doctorId === scopedDoctor.id;
  }

  if (patientId) {
    return patientIds.includes(patientId);
  }

  return false;
};

const getNotificationScope = async (req) => {
  const scopedDoctor = await getScopedDoctor(req);

  if (!scopedDoctor) {
    return { scopedDoctor: null, patientIds: null };
  }

  const patientIds = await getDoctorPatientIds(scopedDoctor.id);
  return { scopedDoctor, patientIds };
};

const getAccessibleNotifications = async (req) => {
  const { scopedDoctor, patientIds } = await getNotificationScope(req);
  const rawNotifications = await prisma.adminNotification.findMany({
    orderBy: { createdAt: 'desc' },
    take: scopedDoctor ? 200 : 50,
  });

  if (!scopedDoctor) {
    return {
      notifications: rawNotifications,
      unreadCount: rawNotifications.filter((notification) => !notification.read).length,
      scopedDoctor,
      patientIds,
    };
  }

  const notifications = rawNotifications.filter((notification) =>
    canDoctorAccessNotification(notification, scopedDoctor, patientIds)
  );

  return {
    notifications: notifications.slice(0, 50),
    unreadCount: notifications.filter((notification) => !notification.read).length,
    scopedDoctor,
    patientIds,
  };
};

const getNotifications = async (req, res, next) => {
  try {
    const { notifications, unreadCount } = await getAccessibleNotifications(req);
    res.json({ notifications, unreadCount });
  } catch (error) {
    next(error);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await prisma.adminNotification.findUnique({
      where: { id },
    });

    if (!notification) {
      return res.status(404).json({ error: 'الإشعار غير موجود' });
    }

    const { scopedDoctor, patientIds } = await getNotificationScope(req);
    if (scopedDoctor && !canDoctorAccessNotification(notification, scopedDoctor, patientIds)) {
      return res.status(404).json({ error: 'الإشعار غير موجود' });
    }

    const updatedNotification = await prisma.adminNotification.update({
      where: { id },
      data: { read: true },
    });

    res.json({ success: true, notification: updatedNotification });
  } catch (error) {
    next(error);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    const { scopedDoctor, patientIds } = await getNotificationScope(req);

    if (!scopedDoctor) {
      await prisma.adminNotification.updateMany({
        where: { read: false },
        data: { read: true },
      });

      return res.json({ success: true });
    }

    const unreadNotifications = await prisma.adminNotification.findMany({
      where: { read: false },
      select: { id: true, type: true, link: true, read: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const accessibleIds = unreadNotifications
      .filter((notification) => canDoctorAccessNotification(notification, scopedDoctor, patientIds))
      .map((notification) => notification.id);

    if (accessibleIds.length > 0) {
      await prisma.adminNotification.updateMany({
        where: { id: { in: accessibleIds } },
        data: { read: true },
      });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
};
