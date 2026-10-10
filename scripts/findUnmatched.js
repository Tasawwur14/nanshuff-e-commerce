const models = require('../models/sql');
const Product = models.Product;
const {Op} = require('sequelize');

async function findUnmatchedProducts() {
    try {
        // Get products without a category (category is null)
        const unmatched = await Product.findAll({
            where: {category: {[Op.is]: null}},
            raw: true
        });

        console.log(`Found ${unmatched.length} unmatched products:`);
        unmatched.forEach(p => {
            console.log(`  - ${p.name} (ID: ${p.id})`);
        });

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        process.exit(0);
    }
}

findUnmatchedProducts();
