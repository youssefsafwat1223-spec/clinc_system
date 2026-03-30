const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  const prismaErrorNames = new Set([
    'PrismaClientInitializationError',
    'PrismaClientValidationError',
    'PrismaClientKnownRequestError',
    'PrismaClientUnknownRequestError',
    'PrismaClientRustPanicError',
  ]);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'خطأ في البيانات المدخلة',
      details: err.message,
    });
  }

  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'هذا السجل موجود بالفعل',
      field: err.meta?.target,
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'السجل غير موجود',
    });
  }

  if (prismaErrorNames.has(err.name)) {
    return res.status(500).json({
      error: 'مشكلة في تهيئة قاعدة البيانات أو عدم توافق السكيمة الحالية',
    });
  }

  return res.status(err.status || 500).json({
    error: err.status ? err.message : 'حدث خطأ في الخادم',
  });
};

module.exports = errorHandler;
