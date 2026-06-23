const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile, changePassword } = require('../controller/authController');
const { protect, authorize } = require('../middleware/auth');

router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);

router.post('/register', protect, authorize('teacher', 'admin'), register);
module.exports = router;