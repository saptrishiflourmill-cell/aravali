const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/check', authController.check);
router.post('/google', authController.googleSignIn);
router.get('/visitor', require('./visitorMiddleware').authenticateVisitor, authController.getVisitor);

module.exports = router;
