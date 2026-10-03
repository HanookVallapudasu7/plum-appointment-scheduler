const multer = require('multer');
const config = require('../config/env');

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// In-memory storage for secure processing without orphaned disk files
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024 // e.g. 5MB
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      const error = new Error('Unsupported image format. Allowed formats: JPEG, PNG, WEBP.');
      error.code = 'INVALID_IMAGE';
      error.statusCode = 400;
      return cb(error, false);
    }
    cb(null, true);
  }
});

const uploadImageMiddleware = (req, res, next) => {
  const singleUpload = upload.single('image');

  singleUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            status: 'error',
            code: 'FILE_TOO_LARGE',
            message: `Image exceeds maximum allowed size of ${config.MAX_FILE_SIZE_MB}MB.`
          });
        }
        return res.status(400).json({
          status: 'error',
          code: 'UPLOAD_ERROR',
          message: err.message
        });
      }

      if (err.code === 'INVALID_IMAGE') {
        return res.status(400).json({
          status: 'error',
          code: 'INVALID_IMAGE',
          message: err.message
        });
      }

      return res.status(400).json({
        status: 'error',
        code: 'BAD_REQUEST',
        message: err.message || 'File upload failed.'
      });
    }

    next();
  });
};

module.exports = {
  uploadImageMiddleware,
  ALLOWED_MIME_TYPES
};
