const jwt = require('jsonwebtoken');
const config = require('../config/env');
const prisma = require('../lib/prisma');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'غير مصرح - يرجى تسجيل الدخول' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, role: true, active: true },
    });

    if (!user || !user.active) {
      return res.status(401).json({ error: 'المستخدم غير موجود أو غير مفعل' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'انتهت صلاحية الجلسة - يرجى تسجيل الدخول مجدداً' });
    }
    return res.status(401).json({ error: 'توكن غير صالح' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'ليس لديك صلاحية للوصول' });
    }
    next();
  };
};

module.exports = { auth, requireRole };
