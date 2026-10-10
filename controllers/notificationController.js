const Notification = require('../models/Notification');
const { Op } = require('sequelize');
const sqlModels = require('../models/sql');
const User = sqlModels.User;

// Get all notifications (Admin only)
exports.getAllNotifications = async (req, res) => {
    try {
    const notifications = await Notification.findAll({ order: [['createdAt', 'DESC']] });
    res.json(notifications);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get unread notifications count (Admin only)
exports.getUnreadNotificationsCount = async (req, res) => {
    try {
    const count = await Notification.count({ where: { read: false } });
    res.json({ count });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Mark notification as read (Admin only)
exports.markNotificationAsRead = async (req, res) => {
    try {
        const notification = await Notification.findByPk(req.params.id);
        if (!notification) return res.status(404).json({ message: 'Notification not found' });
        notification.read = true;
        await notification.save();
        res.json(notification);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};