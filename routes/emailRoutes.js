const express = require('express');
const router = express.Router();
const { sendEmailCampaign, getEmailCampaignStats } = require('../controllers/emailController');
const { isAdminLoggedIn } = require('../middleware/authMiddleware');

// All email campaign routes require admin authentication
router.use(isAdminLoggedIn);

// Send email campaign
router.post('/campaign', sendEmailCampaign);

// Get email campaign statistics
router.get('/stats', getEmailCampaignStats);

module.exports = router;