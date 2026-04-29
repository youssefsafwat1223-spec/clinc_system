const prisma = require('../lib/prisma');
const { paginate } = require('../utils/helpers');

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

const getScopedPatientIds = async () => null;

const getScopedPatient = async (req, patientId) => prisma.patient.findUnique({ where: { id: patientId } });

const extractCommentTarget = (metadata) => {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  if (metadata.commentId && metadata.source && String(metadata.source).includes('COMMENT')) {
    return {
      commentId: metadata.commentId,
      postId: metadata.postId || null,
      source: metadata.source,
    };
  }

  return null;
};

const getLatestCommentTarget = async (patientId, platform) => {
  const recentMessages = await prisma.message.findMany({
    where: {
      patientId,
      platform,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  for (const message of recentMessages) {
    const target = extractCommentTarget(message.metadata);
    if (target) {
      return target;
    }

    const source = message.metadata?.source;
    if (!source || !String(source).includes('COMMENT')) {
      break;
    }
  }

  return null;
};

const createOutboundMessage = async ({ patientId, platform, content, metadata = null, reviewedById = null }) =>
  prisma.message.create({
    data: {
      patientId,
      platform,
      content,
      type: 'OUTBOUND',
      ...(reviewedById ? { reviewedById, reviewedAt: new Date() } : {}),
      ...(metadata ? { metadata } : {}),
    },
    include: {
      patient: { select: { name: true, phone: true } },
    },
  });

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, platform, patientId, unread, humanOnly, reviewed } = req.query;
    const { skip, take } = paginate(Number(page), Number(limit));
    const scopedPatientIds = await getScopedPatientIds(req);

    if (scopedPatientIds && scopedPatientIds.length === 0) {
      return res.json({
        messages: [],
        pagination: { page: Number(page), limit: Number(limit), total: 0, pages: 0 },
      });
    }

    const where = {};
    if (platform) {
      where.platform = platform;
    }

    if (unread === 'true') {
      where.type = 'INBOUND';
      where.readAt = null;
    }

    if (reviewed === 'true') {
      where.reviewedAt = { not: null };
    } else if (reviewed === 'false') {
      where.reviewedAt = null;
    }

    if (scopedPatientIds) {
      where.patientId = patientId
        ? { in: scopedPatientIds.filter((id) => id === patientId) }
        : { in: scopedPatientIds };
    } else if (patientId) {
      where.patientId = patientId;
    }

    const patientWhere = humanOnly === 'true' ? { chatState: 'HUMAN' } : undefined;
    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: patientWhere ? { ...where, patient: patientWhere } : where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              phone: true,
              platform: true,
              chatState: true,
              displayName: true,
            },
          },
          reviewedBy: { select: { id: true, name: true, displayName: true } },
        },
      }),
      prisma.message.count({ where: patientWhere ? { ...where, patient: patientWhere } : where }),
    ]);

    res.json({
      messages,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getConversation = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const scopedPatientIds = await getScopedPatientIds(req);

    if (scopedPatientIds && !scopedPatientIds.includes(patientId)) {
      return res.status(404).json({ error: 'المحادثة غير موجودة' });
    }

    const [messages, patient] = await Promise.all([
      prisma.message.findMany({
        where: { patientId },
        orderBy: { createdAt: 'asc' },
        include: {
          patient: {
            select: { name: true, displayName: true, phone: true, platform: true },
          },
          reviewedBy: { select: { id: true, name: true, displayName: true } },
        },
      }),
      prisma.patient.findUnique({
        where: { id: patientId },
        select: { id: true, name: true, displayName: true, phone: true, platform: true, chatState: true },
      }),
    ]);

    await prisma.message.updateMany({
      where: { patientId, type: 'INBOUND', readAt: null },
      data: { readAt: new Date() },
    });

    res.json({ messages, patient });
  } catch (error) {
    next(error);
  }
};

const sendManual = async (req, res, next) => {
  try {
    const { patientId, content, platform, replyToComment = false } = req.body;
    const whatsappService = require('../services/whatsappService');
    const messengerService = require('../services/messengerService');
    const instagramService = require('../services/instagramService');

    const trimmedContent = content?.trim();
    if (!trimmedContent) {
      return res.status(400).json({ error: 'محتوى الرسالة مطلوب' });
    }

    const patient = await getScopedPatient(req, patientId);
    if (!patient) {
      return res.status(404).json({ error: 'المريض غير موجود' });
    }

    const sendPlatform = platform || patient.platform;
    const senderName = req.user?.displayName || req.user?.name || '';
    const deliveredContent = senderName ? `${senderName}: ${trimmedContent}` : trimmedContent;
    let message = null;
    let metadata = null;

    switch (sendPlatform) {
      case 'WHATSAPP':
        await whatsappService.sendTextMessage(patient.phone, deliveredContent);
        break;

      case 'FACEBOOK': {
        const commentTarget = replyToComment ? await getLatestCommentTarget(patientId, 'FACEBOOK') : null;
        if (commentTarget?.commentId) {
          await messengerService.sendCommentReply(commentTarget.commentId, deliveredContent);
          metadata = {
            source: 'COMMENT_REPLY',
            delivery: 'PUBLIC_COMMENT',
            commentId: commentTarget.commentId,
            postId: commentTarget.postId,
            manual: true,
          };
        } else {
          await messengerService.sendTextMessage(patient.facebookId || patient.phone, deliveredContent);
        }

        message = await createOutboundMessage({
          patientId,
          platform: 'FACEBOOK',
          content: deliveredContent,
          metadata: { ...(metadata || {}), originalContent: trimmedContent, senderName },
          reviewedById: req.user?.id,
        });
        break;
      }

      case 'INSTAGRAM': {
        const commentTarget = replyToComment ? await getLatestCommentTarget(patientId, 'INSTAGRAM') : null;
        if (commentTarget?.commentId) {
          await instagramService.sendCommentReply(commentTarget.commentId, deliveredContent);
          metadata = {
            source: 'COMMENT_REPLY',
            delivery: 'PUBLIC_COMMENT',
            commentId: commentTarget.commentId,
            postId: commentTarget.postId,
            manual: true,
          };
        } else {
          await instagramService.sendTextMessage(patient.instagramId || patient.phone, deliveredContent);
        }

        message = await createOutboundMessage({
          patientId,
          platform: 'INSTAGRAM',
          content: deliveredContent,
          metadata: { ...(metadata || {}), originalContent: trimmedContent, senderName },
          reviewedById: req.user?.id,
        });
        break;
      }

      default: {
        const err = new Error('Unsupported platform');
        err.status = 400;
        throw err;
      }
    }

    await prisma.patient.update({
      where: { id: patientId },
      data: { chatState: 'HUMAN' },
    });

    await prisma.message.updateMany({
      where: { patientId, type: 'INBOUND', reviewedAt: null },
      data: { reviewedAt: new Date(), reviewedById: req.user?.id || null, readAt: new Date() },
    });

    res.status(201).json({ success: true, message });
  } catch (error) {
    next(error);
  }
};

const pauseBot = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const existingPatient = await getScopedPatient(req, patientId);
    if (!existingPatient) {
      return res.status(404).json({ error: 'المريض غير موجود' });
    }

    const patient = await prisma.patient.update({
      where: { id: patientId },
      data: { chatState: 'HUMAN' },
      select: { id: true, name: true, phone: true, platform: true, chatState: true },
    });

    res.json({ success: true, patient });
  } catch (error) {
    next(error);
  }
};

const endConversation = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const existingPatient = await getScopedPatient(req, patientId);
    if (!existingPatient) {
      return res.status(404).json({ error: 'المريض غير موجود' });
    }

    const patient = await prisma.patient.update({
      where: { id: patientId },
      data: { chatState: 'BOT' },
    });

    const closureMessage =
      'تم إنهاء المحادثة المباشرة مع خدمة العملاء. سيعود الرد الآلي لمساعدتك كالمعتاد.';
    const whatsappChannel = require('../services/whatsappService');
    const messengerChannel = require('../services/messengerService');
    const instagramChannel = require('../services/instagramService');

    switch (patient.platform) {
      case 'WHATSAPP':
        await whatsappChannel.sendTextMessage(patient.phone, closureMessage);
        break;

      case 'FACEBOOK':
        await messengerChannel.sendTextMessage(patient.facebookId || patient.phone, closureMessage);
        await createOutboundMessage({
          patientId,
          platform: 'FACEBOOK',
          content: closureMessage,
        });
        break;

      case 'INSTAGRAM':
        await instagramChannel.sendTextMessage(patient.instagramId || patient.phone, closureMessage);
        await createOutboundMessage({
          patientId,
          platform: 'INSTAGRAM',
          content: closureMessage,
        });
        break;

      default: {
        const err = new Error('Unsupported platform');
        err.status = 400;
        throw err;
      }
    }

    res.json({ success: true, patient });
  } catch (error) {
    next(error);
  }
};

const markRead = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const existingPatient = await getScopedPatient(req, patientId);
    if (!existingPatient) return res.status(404).json({ error: 'المريض غير موجود' });

    await prisma.message.updateMany({
      where: { patientId, type: 'INBOUND', readAt: null },
      data: { readAt: new Date() },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAll, getConversation, sendManual, endConversation, pauseBot, markRead };
