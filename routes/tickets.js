const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const controller = require('../controllers/ticketController');
const { authenticateToken } = require('./authMiddleware');
const { authenticateVisitor, optionalVisitor } = require('./visitorMiddleware');

const validateTicket = [
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('eventDate').trim().notEmpty().withMessage('Event date is required'),
];

router.get('/stats', authenticateToken, controller.getStats);
router.get('/', authenticateToken, controller.getAll);
router.post('/purchase', optionalVisitor, validateTicket, controller.purchase);
router.get('/mine', authenticateVisitor, controller.getMyTickets);
router.post('/link', authenticateVisitor, controller.linkTicket);
router.get('/verify/:id', controller.scanTicket);
router.get('/download-qr/:id', controller.getQRCode);
router.get('/:id', controller.getById);
router.put('/:id', authenticateToken, controller.update);
router.delete('/:id', authenticateToken, controller.delete);

module.exports = router;
