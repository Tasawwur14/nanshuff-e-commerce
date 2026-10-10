// Check and fix product categories
const models = require('../models/sql');
const { sequelize } = models;
const Product = models.Product;
const Category = models.Category;

async function checkAndFixCategories() {
    try {
        // Get all categories
        const categories = await Category.findAll();
        console.log('Available categories:');
        categories.forEach(cat => {
            console.log(`  - ${cat.name} (ID: ${cat.id})`);
        });

        // Get all products
        const products = await Product.findAll({ limit: 50 });
        console.log(`\nFirst 50 products and their categories:`);
        
        let productsWithoutCategory = 0;
        let productsWithCategory = 0;
        
        products.forEach((product, idx) => {
            if (product.category) {
                console.log(`${idx + 1}. ${product.name} - Category: "${product.category}"`);
                productsWithCategory++;
            } else {
                console.log(`${idx + 1}. ${product.name} - Category: NONE`);
                productsWithoutCategory++;
            }
        });

        console.log(`\n--- SUMMARY ---`);
        console.log(`Products with category: ${productsWithCategory}`);
        console.log(`Products without category: ${productsWithoutCategory}`);

        // Look for French Fries related products
        console.log(`\n--- FRENCH FRIES PRODUCTS ---`);
        const frenchFriesProducts = await Product.findAll({
            where: {
                name: { [require('sequelize')].Op: { [require('sequelize').Op.like]: '%Fries%' } }
            }
        });

        if (frenchFriesProducts.length === 0) {
            const allProducts = await Product.findAll({ raw: true });
            const friesMatches = allProducts.filter(p => p.name && p.name.includes('Fries'));
            console.log(`Found ${friesMatches.length} products with "Fries" in name:`);
            friesMatches.forEach(p => {
                console.log(`  - ${p.name} (Category: "${p.category || 'NONE'}", CategoryID: ${p.categoryId})`);
            });
        }

        // Get total product count
        const totalCount = await Product.count();
        console.log(`\nTotal products in database: ${totalCount}`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        process.exit(0);
    }
}

checkAndFixCategories();
