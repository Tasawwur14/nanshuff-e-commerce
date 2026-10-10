const Category = require('../models/Category');
const { sequelize } = require('../config/database');
const sqlModels = require('../models/sql');
const Product = require('../models/Product');

const createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ message: 'Category name is required' });
    const exists = await Category.findOne({ where: { name: name.trim() } });
    if (exists) return res.status(400).json({ message: 'Category already exists' });
    const cat = await Category.create({ name: name.trim(), description });
    res.status(201).json(cat);
    } catch (err) {
        res.status(500).json({ message: 'Error creating category', error: err && err.message ? err.message : err });
    }
};

const listCategories = async (req, res) => {
    try {
    const cats = await Category.findAll({ order: [['name', 'ASC']] });
    res.status(200).json(cats.map(c => c.name));
    } catch (err) {
        res.status(500).json({ message: 'Error fetching categories' });
    }
};

const syncCategories = async (req, res) => {
    try {
        // gather distinct categories from Product documents
        const productCats = await Product.findAll({ attributes: [[sequelize.fn('DISTINCT', sequelize.col('category')), 'category']] });
        const names = (productCats || []).map(c => c.category).filter(Boolean).map(c => String(c).trim()).filter(Boolean);
        const created = [];
        for (const nm of names) {
            // upsert via findOrCreate
            const [cat, wasCreated] = await Category.findOrCreate({ where: { name: nm }, defaults: { name: nm } });
            if (wasCreated) created.push(nm);
        }
        const all = await Category.findAll({ order: [['name', 'ASC']], attributes: ['name'] });
        res.status(200).json({ created, categories: all.map(c => c.name) });
    } catch (err) {
        res.status(500).json({ message: 'Error syncing categories', error: err && err.message ? err.message : err });
    }
};

module.exports = { createCategory, listCategories };
module.exports.syncCategories = syncCategories;