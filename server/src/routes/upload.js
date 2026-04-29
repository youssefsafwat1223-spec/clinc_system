const express = require('express');
const multer = require('multer');
const path = require('path');
const { auth, requireRole } = require('../middleware/auth');
const fs = require('fs');

const router = express.Router();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../public/images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('يسمح فقط برفع الصور (jpeg, jpg, png, webp, gif)'));
  },
});

router.use(auth);

router.post('/', requireRole('ADMIN'), upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'الرجاء اختيار صورة لرفعها' });
  }

  // Return a relative URL which is more robust behind proxies
  const fileUrl = `/api/images/${req.file.filename}`;

  res.json({
    message: 'تم رفع الصورة بنجاح',
    url: fileUrl,
  });
});

router.post('/campaign-image', requireRole('ADMIN', 'STAFF'), upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'الرجاء اختيار صورة للحملة' });
  }

  res.json({
    message: 'تم رفع صورة الحملة بنجاح',
    url: `/api/images/${req.file.filename}`,
  });
});

module.exports = router;
