const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const paymentController = require('../controllers/paymentController');

const validateOrder = [
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('eventDate').trim().notEmpty().withMessage('Event date is required'),
];

router.post('/create-order', validateOrder, paymentController.createOrder);
router.post('/verify-payment', paymentController.verifyPayment);

module.exports = router;
