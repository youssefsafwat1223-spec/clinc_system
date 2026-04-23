const prisma = require('../lib/prisma');

const getAll = async (req, res, next) => {
  try {
    const { doctorId, from, to } = req.query;

    const where = {
      rating: { not: null },
      ...(doctorId ? { doctorId } : {}),
    };

    if (from || to) {
      where.repliedAt = {};
      if (from) where.repliedAt.gte = new Date(from);
      if (to) where.repliedAt.lte = new Date(`${to}T23:59:59.999Z`);
    }

    const reviews = await prisma.review.findMany({
      where,
      include: {
        patient: { select: { name: true, phone: true } },
        doctor: { select: { name: true, specialization: true } },
        appointment: { select: { scheduledTime: true, service: { select: { nameAr: true } } } },
      },
      orderBy: { repliedAt: 'desc' },
    });

    res.json({ reviews });
  } catch (error) {
    next(error);
  }
};

const getStats = async (req, res, next) => {
  try {
    const completedReviews = await prisma.review.findMany({
      where: { rating: { not: null } },
      select: { rating: true, doctorId: true },
    });

    const totalReviews = completedReviews.length;
    const avgRating = totalReviews > 0
      ? (completedReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
      : 0;

    // Group by doctor
    const doctorMap = {};
    for (const review of completedReviews) {
      if (!doctorMap[review.doctorId]) {
        doctorMap[review.doctorId] = { count: 0, sum: 0 };
      }
      doctorMap[review.doctorId].count++;
      doctorMap[review.doctorId].sum += review.rating;
    }

    const doctors = await prisma.doctor.findMany({
      where: { id: { in: Object.keys(doctorMap) } },
      select: { id: true, name: true },
    });

    const doctorStats = doctors.map((doctor) => ({
      doctorId: doctor.id,
      doctorName: doctor.name,
      count: doctorMap[doctor.id].count,
      avg: (doctorMap[doctor.id].sum / doctorMap[doctor.id].count).toFixed(1),
    })).sort((a, b) => parseFloat(b.avg) - parseFloat(a.avg));

    // Pending (sent but not replied)
    const pendingCount = await prisma.review.count({ where: { rating: null } });

    res.json({
      totalReviews,
      avgRating: parseFloat(avgRating),
      pendingCount,
      doctorStats,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAll, getStats };
