// ── Image Upload Route ───────────────────────────────────────────────────────
// POST /api/upload/image  — accepts multipart/form-data with field "image"
// Returns { url, filename, size }
const express   = require('express');
const multer    = require('multer');
const path      = require('path');
const fs        = require('fs');
const crypto    = require('crypto');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Ensure uploads directory exists
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'products');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer storage — deterministic filename based on original name + timestamp
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase() || '.jpg';
    const name = path.basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40);
    const hash = crypto.randomBytes(5).toString('hex');
    cb(null, `${name}-${hash}${ext}`);
  },
});

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPEG, PNG, WebP, GIF and AVIF images are allowed'));
  },
});

// ── POST /api/upload/image ────────────────────────────────────────────────────
router.post('/image', requireAuth, requireRole('owner', 'manager'), upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file provided' });
  const url = `/uploads/products/${req.file.filename}`;
  res.json({
    url,
    filename: req.file.filename,
    size:     req.file.size,
    mimetype: req.file.mimetype,
  });
});

// ── DELETE /api/upload/image/:filename ───────────────────────────────────────
router.delete('/image/:filename', requireAuth, requireRole('owner', 'manager'), (req, res) => {
  const filename = path.basename(req.params.filename); // strip path traversal
  const filePath = path.join(UPLOAD_DIR, filename);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Multer error handler
router.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Image too large — max 8 MB' });
  res.status(400).json({ error: err.message });
});

module.exports = router;
