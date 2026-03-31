const multer = require('multer');
const path = require('path');

// Configure Multer for memory storage (Supabase upload)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /pdf|doc|docx|ppt|pptx|txt|jpg|png|jpeg/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only PDF, DOC, PPT, TXT, images allowed'));
  }
});

module.exports = upload;
