// server/controllers/productController.js

const Product = require('../models/Product');
const { Op } = require('sequelize');

// GET all products (Public) - UPDATED WITH ADVANCED FILTERS
const getAllProducts = async (req, res) => {
    try {
        const { category, inStock, minPrice, maxPrice, minDiscount, dietary, sort, page = 1, limit = 30, featured } = req.query;
        console.log('📦 getAllProducts called with params:', { page, limit, category, sort, featured });
        
        // Log database type for debugging
        const { DB_TYPE } = require('../config/database');
        console.log(`📊 Using ${DB_TYPE.toUpperCase()} database`);
        
        const filter = {};

        // Filter logic
        if (category) {
            // For a single category, use exact match
            // For multiple categories (comma-separated), use IN operator
            const categories = category.split(',');
            if (categories.length === 1) {
                filter.category = categories[0];
            } else {
                filter.category = { [Op.in]: categories };
            }
        }
        
        if (dietary) filter.dietary = dietary;
        
        // Handle availability filter
        if (req.query.availability === 'inStock') {
            filter.status = 'In Stock';
        } else if (req.query.availability === 'outofStock') {
            filter.status = 'Out of Stock';
        }
        
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price[Op.gte] = Number(minPrice);
            if (maxPrice) filter.price[Op.lte] = Number(maxPrice);
        }

        if (minDiscount && Number(minDiscount) > 0) {
            filter.discount = { [Op.gte]: Number(minDiscount) };
        }
        
        if (featured === 'true') {
            filter.featured = true;
        }

        // Sort logic
        let sortOptions = {};
        if (sort === 'price_asc') sortOptions.price = 1;
        else if (sort === 'price_desc') sortOptions.price = -1;
        else if (sort === 'discount_desc') sortOptions.discount = -1; // Discount High to Low
        else if (sort === 'discount_asc') sortOptions.discount = 1; // Discount Low to High
        else sortOptions.createdAt = -1;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Build Sequelize where clause from filter
        const where = {};
        if (filter.category) where.category = filter.category;
        if (filter.dietary) where.dietary = filter.dietary;
        if (filter.price) {
            where.price = {};
            if (filter.price[Op.gte]) where.price[Op.gte] = filter.price[Op.gte];
            if (filter.price[Op.lte]) where.price[Op.lte] = filter.price[Op.lte];
        }
        if (filter.discount) {
            where.discount = {};
            if (filter.discount[Op.gte]) where.discount[Op.gte] = filter.discount[Op.gte];
        }
        if (filter.featured) where.featured = true;
        if (req.query.availability === 'inStock') where.stock = { [Op.gt]: 0 };
        if (req.query.availability === 'outofStock') where.stock = { [Op.lte]: 0 };

        // Build order array for Sequelize
        const order = [];
        if (sort === 'price_asc') order.push(['price', 'ASC']);
        else if (sort === 'price_desc') order.push(['price', 'DESC']);
        else if (sort === 'discount_desc') order.push(['discount', 'DESC']);
        else if (sort === 'discount_asc') order.push(['discount', 'ASC']);
        else order.push(['createdAt', 'DESC']);

        const findOptions = {
            where,
            order,
            offset: skip,
            limit: limitNum
        };

        // If requesting only featured products via this endpoint, limit to a small set
        if (featured === 'true') {
            findOptions.limit = 8;
            findOptions.offset = 0;
            findOptions.where = { ...findOptions.where, featured: true };
        }

        const products = await Product.findAll(findOptions);
        const totalProducts = await Product.count({ where });
        const totalPages = Math.ceil(totalProducts / limitNum);

        console.log(`✅ Found ${products.length} products, total: ${totalProducts}, pages: ${totalPages}`);

        res.status(200).json({
            products,
            currentPage: pageNum,
            totalPages: totalPages > 0 ? totalPages : 1, // Ensure totalPages is at least 1
            totalProducts
        });

    } catch (error) {
        console.error('❌ Error fetching products:', error.message, error.stack);
        res.status(500).json({ msg: "Server Error", error: error.message });
    }
};

// GET all products for Admin Dashboard (with full details, no pagination limit)
const getAllProductsForAdmin = async (req, res) => {
    try {
        console.log('🔐 getAllProductsForAdmin called (Admin only)');
        
        // No pagination limit for admin dashboard
        const products = await Product.findAll({
            order: [['createdAt', 'DESC']]
        });
        
        console.log(`✅ Admin fetched ${products.length} products from database`);
        
        res.status(200).json({
            products,
            total: products.length
        });
    } catch (error) {
        console.error('❌ Error fetching products for admin:', error.message, error.stack);
        res.status(500).json({ msg: "Server Error", error: error.message });
    }
};

// GET a single product by ID (Public)
const getProductById = async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id);
        if (!product) {
            return res.status(404).json({ msg: "Product not found" });
        }
        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ msg: "Server Error", error: error.message });
    }
};

// SEARCH products function
const models = require('../models/sql');
const { sequelize } = models;

const searchProducts = async (req, res) => {
    try {
        const { q } = req.query;
        
        console.log('Search query received:', q); // Debug log
        
        if (!q) {
            return res.status(400).json({ msg: "Search query is required" });
        }
        
        // Validate that the query is a string and not too long
        if (typeof q !== 'string' || q.length > 50) {
            return res.status(400).json({ msg: "Invalid search query" });
        }
        
        // Escape special regex characters to prevent regex errors
        const escapedQuery = q.replace(/[.*+?^${}()|\\]/g, '\\$&');
        
        console.log('Escaped query:', escapedQuery); // Debug log
        
        // Create a case-insensitive search across relevant fields
        const searchRegex = new RegExp(escapedQuery, 'i');
        
        // Use Sequelize LIKE for simple search. This is compatible with SQLite and other SQL DBs.
        const likeQuery = `%${escapedQuery}%`;
        const products = await Product.findAll({
            where: {
                [Op.or]: [
                    { name: { [Op.like]: likeQuery } },
                    { description: { [Op.like]: likeQuery } }
                ]
            },
            limit: 10
        }); // Limit to 10 results for better performance
        
        console.log(`Found ${products.length} products for query:`, q); // Debug log
        
        res.status(200).json(products);
    } catch (error) {
        console.error("Search error:", error); // Add server-side logging
        res.status(500).json({ msg: "Server Error during search", error: error.message });
    }
};

/// Naya function jo saare available filters return karega
const getFilterOptions = async (req, res) => {
    try {
        // Merge categories from a dedicated Category collection (if present)
        // and categories already present on Product documents. This ensures
        // frontend filters include categories created via product adds even if
        // the Category collection hasn't been seeded.
        let categoryNames = new Set();
        try {
            const Category = require('../models/Category');
            const cats = await Category.findAll({ attributes: ['name'], order: [['name', 'ASC']] });
            (cats || []).forEach(c => categoryNames.add(c.name));
        } catch (e) {
            // ignore if Category model isn't present
        }

        try {
                // Get distinct product categories - compatible with MySQL and SQLite
                // Use raw query for better compatibility
                const productCats = await Product.findAll({ 
                    attributes: ['category'],
                    where: { category: { [Op.ne]: null } },
                    raw: true,
                    subQuery: false
                });
                (productCats || []).forEach(c => { 
                    if (c && c.category) categoryNames.add(c.category);
                });
        } catch (e) {
            console.error('Error fetching distinct categories:', e.message);
            // ignore
        }

        const categories = Array.from(categoryNames).sort();
        let brands = [];
        let statuses = [];
        try {
            const brandRows = await Product.findAll({ attributes: [[sequelize.fn('DISTINCT', sequelize.col('brand')), 'brand']] });
            brands = brandRows.map(r => (r.get ? r.get('brand') : r.brand)).filter(Boolean);
        } catch (e) { brands = []; }
        try {
            const statusRows = await Product.findAll({ attributes: [[sequelize.fn('DISTINCT', sequelize.col('status')), 'status']] });
            statuses = statusRows.map(r => (r.get ? r.get('status') : r.status)).filter(Boolean);
        } catch (e) { statuses = []; }
        res.status(200).json({ categories, brands, statuses });
    } catch (error) {
        res.status(500).json({ msg: "Server Error getting filters" });
    }
};

/// Naya function jo featured products return karega
const getFeaturedProducts = async (req, res) => {
    try {
        const featuredProducts = await Product.findAll({
            where: {
                featured: true,
                stock: { [Op.gt]: 0 }
            },
            limit: 8,
            order: [['createdAt', 'DESC']]
        });
        res.status(200).json(featuredProducts);
    } catch (error) {
        res.status(500).json({ msg: "Server Error getting featured products", error: error.message });
    }
};


// ADD a new product (Admin only)
const addProduct = async (req, res) => {
    try {
        console.log('📝 Product Creation Request');
        console.log('🔐 Admin:', req.admin?.id);
        console.log('📨 Content-Type Header:', req.headers['content-type']);
        console.log('Body:', req.body);
        console.log('Files:', req.files ? Object.keys(req.files) : 'None');
        
        // Check for boundary markers in body (diagnostic)
        if (req.body && typeof req.body === 'object') {
            Object.entries(req.body).forEach(([key, value]) => {
                if (typeof value === 'string' && value.includes('------')) {
                    console.warn(`⚠️  BOUNDARY MARKER DETECTED in field "${key}":`, value.substring(0, 100));
                }
            });
        }
        
        const newProductData = { ...req.body };
        
        // Handle Cloudinary uploads
        // multer-storage-cloudinary stores the secure_url in file.path
        if (req.files && req.files.length > 0) {
            const imageUrlFile = req.files.find(file => file.fieldname === 'imageUrl');
            if (imageUrlFile) {
                newProductData.imageUrl = imageUrlFile.path;
                console.log('✅ Main image uploaded to Cloudinary:', newProductData.imageUrl);
            }

            const galleryImageFiles = req.files.filter(file => file.fieldname === 'galleryImages');
            if (galleryImageFiles.length > 0) {
                newProductData.galleryImages = galleryImageFiles.map(file => file.path);
                console.log('✅ Gallery images uploaded to Cloudinary:', newProductData.galleryImages.length, 'files');
            }

            const videoUrlFile = req.files.find(file => file.fieldname === 'videoUrl');
            if (videoUrlFile) {
                newProductData.videoUrl = videoUrlFile.path;
                console.log('✅ Video uploaded to Cloudinary:', newProductData.videoUrl);
            }
        }
        
        // If Category model exists, upsert the category used by this product so
        // filters reflect newly added categories.
        try {
            const Category = require('../models/Category');
            if (newProductData.category) {
                // Use findOrCreate/upsert semantics to ensure category exists
                try {
                    if (typeof Category.upsert === 'function') {
                        await Category.upsert({ name: newProductData.category });
                    } else {
                        await Category.findOrCreate({ where: { name: newProductData.category }, defaults: { name: newProductData.category } });
                    }
                } catch (errCat) {
                    // ignore category upsert errors
                }
            }
        } catch (e) {
            // ignore when Category model isn't present or any other error
        }

        console.log('🛠️ Creating product with data:', newProductData);
        const newProduct = await Product.create(newProductData);
        console.log('✅ Product created successfully:', newProduct.id);
        res.status(201).json(newProduct);
    } catch (err) {
        console.error('❌ Error creating product:', err);
        // If mongoose validation error, build a concise message map
        if (err && err.name === 'ValidationError') {
            const errors = Object.keys(err.errors || {}).reduce((acc, key) => {
                acc[key] = err.errors[key].message;
                return acc;
            }, {});
            return res.status(400).json({ message: 'Validation failed', errors });
        }
        // For Sequelize errors
        if (err && err.name === 'SequelizeValidationError') {
            const errors = {};
            if (err.errors) {
                err.errors.forEach(e => {
                    errors[e.path] = e.message;
                });
            }
            console.error('Sequelize Validation Errors:', errors);
            return res.status(400).json({ message: 'Validation failed', errors });
        }
        res.status(400).json({ message: 'Error adding product', error: err && err.message ? err.message : err });
    }
};

// UPDATE a product (Admin only)
const updateProduct = async (req, res) => {
    try {
        console.log('✏️ Product Update Request');
        console.log('🔐 Admin:', req.admin?.id);
        console.log('Product ID:', req.params.id);
        console.log('Body:', req.body);
        console.log('Files:', req.files ? Object.keys(req.files) : 'None');
        
        const updateData = { ...req.body };
        
        // Handle Cloudinary uploads
        // multer-storage-cloudinary stores the secure_url in file.path
        if (req.files && req.files.length > 0) {
            const imageUrlFile = req.files.find(file => file.fieldname === 'imageUrl');
            if (imageUrlFile) {
                updateData.imageUrl = imageUrlFile.path;
                console.log('✅ Updated main image on Cloudinary:', updateData.imageUrl);
            }

            const galleryImageFiles = req.files.filter(file => file.fieldname === 'galleryImages');
            if (galleryImageFiles.length > 0) {
                updateData.galleryImages = galleryImageFiles.map(file => file.path);
                console.log('✅ Updated gallery images on Cloudinary:', updateData.galleryImages.length, 'files');
            }

            const videoUrlFile = req.files.find(file => file.fieldname === 'videoUrl');
            if (videoUrlFile) {
                updateData.videoUrl = videoUrlFile.path;
                console.log('✅ Updated video on Cloudinary:', updateData.videoUrl);
            }
        }
    const [affectedCount] = await Product.update(updateData, { where: { id: req.params.id } });
    if (!affectedCount) {
        console.log('❌ Product not found for update, ID:', req.params.id);
        return res.status(404).json({ message: "Product not found" });
    }
    const updatedProduct = await Product.findByPk(req.params.id);
    console.log('✅ Product updated successfully:', updatedProduct.id);
    res.status(200).json(updatedProduct);
    } catch (err) {
        console.error('❌ Error updating product:', err);
        if (err && err.name === 'ValidationError') {
            const errors = Object.keys(err.errors || {}).reduce((acc, key) => {
                acc[key] = err.errors[key].message;
                return acc;
            }, {});
            return res.status(400).json({ message: 'Validation failed', errors });
        }
        res.status(400).json({ message: 'Error updating product', error: err && err.message ? err.message : err });
    }
};

// DELETE a product (Admin only)
const deleteProduct = async (req, res) => {
    try {
        const deletedCount = await Product.destroy({ where: { id: req.params.id } });
        if (!deletedCount) {
            return res.status(404).json({ message: "Product not found" });
        }
        res.status(200).json({ message: 'Product deleted successfully.' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting product', error: err });
    }
};

// FINAL EXPORTS - Naya function 'getFilterOptions' yahan add kiya gaya hai
module.exports = {
    getAllProducts,
    getAllProductsForAdmin,
    getProductById,
    getFilterOptions,
    getFeaturedProducts, // Add getFeaturedProducts to exports
    searchProducts,  // Add searchProducts to exports
    addProduct,
    updateProduct,
    deleteProduct
};