const express = require('express');
const router = express.Router();
const { createCategory, listCategories } = require('../controllers/categoryController');
const { syncCategories } = require('../controllers/categoryController');
const { isAdminLoggedIn } = require('../middleware/authMiddleware');

router.get('/', listCategories);
router.post('/', isAdminLoggedIn, createCategory);
router.post('/sync', isAdminLoggedIn, syncCategories);

module.exports = router;
