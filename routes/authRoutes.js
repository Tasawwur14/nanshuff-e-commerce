const express = require('express');
const router = express.Router();
const { signupUser, loginUser, loginAdmin, getAllUsers, updateAdminProfile, updateAdminPassword, getAdminProfile, getUserProfile, updateUserProfile, forgotPassword, resetPassword } = require('../controllers/authController');
const { isAdminLoggedIn, isLoggedIn } = require('../middleware/authMiddleware');
const { validateSignup, validateLogin, validateAdminLogin } = require('../middleware/validationMiddleware');

// User Routes
router.post('/signup', validateSignup, signupUser);
router.post('/login', validateLogin, loginUser);
router.get('/profile', isLoggedIn, getUserProfile);
router.put('/profile', isLoggedIn, updateUserProfile);

// Verify if user is authenticated
router.get('/verify', isLoggedIn, (req, res) => {
    res.json({ success: true, user: req.user });
});

// Logout (clears auth cookie)
router.post('/logout', (req, res) => {
	res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
	if (req.session) req.session.destroy(() => {});
	res.json({ success: true });
});

// Forgot password route
router.post('/forgot-password', forgotPassword);

// Reset password route
router.post('/reset-password', resetPassword);

// Admin Route
router.post('/admin/login', validateAdminLogin, loginAdmin);

// New route to get all users (Admin only)
router.get('/users', isAdminLoggedIn, getAllUsers);

// New routes for profile management (Admin only)
router.get('/admin/profile', isAdminLoggedIn, getAdminProfile);
router.put('/admin/profile', isAdminLoggedIn, updateAdminProfile);
router.put('/admin/change-password', isAdminLoggedIn, updateAdminPassword);

module.exports = router;