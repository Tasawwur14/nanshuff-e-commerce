const express = require('express');
const router = express.Router();
const { seedDatabase } = require('../utils/mockDataGenerator');
const { isAdminLoggedIn } = require('../middleware/authMiddleware');
const analyticsController = require('../controllers/analyticsController');

// Development route to seed mock data (only available in development)
router.post('/seed', isAdminLoggedIn, async (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
        return res.status(404).json({ message: 'This endpoint is only available in development mode' });
    }
    
    try {
        const success = await seedDatabase();
        if (success) {
            res.status(200).json({ message: 'Database seeded successfully with mock data' });
        } else {
            res.status(500).json({ message: 'Failed to seed database' });
        }
    } catch (error) {
        console.error('Error in seed route:', error);
        res.status(500).json({ message: 'Server error during seeding', error: error.message });
    }
});

module.exports = router;

// Development helper: expose analytics dashboard without auth for quick debugging
if (process.env.NODE_ENV === 'development') {
    router.get('/analytics-debug', async (req, res) => {
        // Forward request to controller (it will use req.query.days if provided)
        return analyticsController.getDashboardMetrics(req, res);
    });
}