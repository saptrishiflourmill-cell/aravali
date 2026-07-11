const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { body } = require('express-validator');
const controller = require('../controllers/visitorController');
const { authenticateToken } = require('./authMiddleware');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(DATA_DIR, 'uploads');
    if (!require('fs').existsSync(dir)) require('fs').mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueName + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
});

const validateVisitor = [
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('address').trim().notEmpty().withMessage('Address is required'),
  body('company').trim().notEmpty().withMessage('Company is required'),
  body('personToMeet').trim().notEmpty().withMessage('Person to meet is required'),
  body('purpose').trim().notEmpty().withMessage('Purpose is required'),
  body('entryDate').trim().notEmpty().withMessage('Entry date is required'),
  body('entryTime').trim().notEmpty().withMessage('Entry time is required'),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Invalid email'),
];

router.get('/stats', authenticateToken, controller.getStats);
router.get('/', authenticateToken, controller.getAll);
router.get('/download-qr/:id', controller.getQRCode);
router.get('/:id', controller.getById);
router.post('/', upload.single('photo'), validateVisitor, controller.create);
router.put('/:id', authenticateToken, upload.single('photo'), controller.update);
router.delete('/:id', authenticateToken, controller.delete);
router.put('/:id/checkin', authenticateToken, controller.checkIn);
router.put('/:id/checkout', authenticateToken, controller.checkOut);
router.post('/upload-photo', authenticateToken, upload.single('photo'), controller.uploadPhoto);

module.exports = router;
