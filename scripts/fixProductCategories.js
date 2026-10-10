const models = require('../models/sql');
const Product = models.Product;
const Category = models.Category;
const {Op} = require('sequelize');

async function fixProductCategories() {
    try {
        console.log('Starting product category fix...\n');

        // Get all categories
        const categories = await Category.findAll({raw: true});
        const categoryMap = {};
        categories.forEach(cat => {
            categoryMap[cat.id] = cat.name;
        });
        
        console.log('Category map:', categoryMap);

        // Get all products with categoryId
        const products = await Product.findAll({
            where: {categoryId: {[Op.not]: null}},
            raw: true
        });

        console.log(`\nFound ${products.length} products with categoryId\n`);

        let updated = 0;
        for (const product of products) {
            const categoryName = categoryMap[product.categoryId];
            if (categoryName && product.category !== categoryName) {
                await Product.update(
                    {category: categoryName},
                    {where: {id: product.id}}
                );
                console.log(`✓ Updated: ${product.name} -> category="${categoryName}"`);
                updated++;
            }
        }

        console.log(`\n=== SUMMARY ===`);
        console.log(`Total updated: ${updated}`);

        // Verify the fix
        console.log(`\n=== VERIFICATION ===`);
        const verify = await Product.findAll({raw: true, limit: 10});
        verify.forEach(p => {
            console.log(`  ${p.name}: category="${p.category}"`);
        });

        // Count by category
        console.log(`\n=== PRODUCTS BY CATEGORY ===`);
        for (const [catId, catName] of Object.entries(categoryMap)) {
            const count = await Product.count({where: {category: catName}});
            console.log(`${catName}: ${count} products`);
        }

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error);
    } finally {
        process.exit(0);
    }
}

fixProductCategories();
