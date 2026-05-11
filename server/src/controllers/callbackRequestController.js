const prisma = require('../lib/prisma');

const statusLabels = {
  NEW: 'جديد',
  CONTACTED: 'تم التواصل',
  CLOSED: 'مغلق',
};

const list = async (req, res, next) => {
  try {
    const { status = 'ALL', platform = 'ALL', search = '', limit = 200 } = req.query;
    const normalizedLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);
    const trimmedSearch = String(search || '').trim();
    const normalizedPlatform = ['WHATSAPP', 'FACEBOOK', 'INSTAGRAM'].includes(String(platform || '').toUpperCase())
      ? String(platform).toUpperCase()
      : 'ALL';

    const requests = await prisma.callbackRequest.findMany({
      where: {
        ...(status !== 'ALL' ? { status } : {}),
        ...(normalizedPlatform !== 'ALL' ? { platform: normalizedPlatform } : {}),
        ...(trimmedSearch
          ? {
              OR: [
                { name: { contains: trimmedSearch, mode: 'insensitive' } },
                { phone: { contains: trimmedSearch, mode: 'insensitive' } },
                { requestMessage: { contains: trimmedSearch, mode: 'insensitive' } },
                { senderId: { contains: trimmedSearch, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            displayName: true,
            phone: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: normalizedLimit,
    });

    const groupedCounts = await prisma.callbackRequest.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const stats = {
      total: groupedCounts.reduce((sum, item) => sum + item._count._all, 0),
      NEW: 0,
      CONTACTED: 0,
      CLOSED: 0,
    };

    for (const item of groupedCounts) {
      stats[item.status] = item._count._all;
    }

    res.json({
      requests,
      stats,
      statusLabels,
      platform: normalizedPlatform,
    });
  } catch (error) {
    next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { status, notes } = req.body;

    if (!['NEW', 'CONTACTED', 'CLOSED'].includes(String(status || ''))) {
      return res.status(400).json({ error: 'حالة الطلب غير صالحة' });
    }

    const request = await prisma.callbackRequest.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(notes !== undefined ? { notes: String(notes || '').trim() || null } : {}),
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            displayName: true,
            phone: true,
          },
        },
      },
    });

    res.json({ request });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  list,
  updateStatus,
};
