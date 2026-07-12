const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/check', authController.check);
router.post('/email-login', authController.emailLogin);
router.get('/visitor', require('./visitorMiddleware').authenticateVisitor, authController.getVisitor);

module.exports = router;
