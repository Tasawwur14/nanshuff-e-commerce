const models = require('../models/sql');
const Product = models.Product;
const Category = models.Category;

async function checkProducts() {
    try {
        console.log('\n=== CATEGORY CHECK ===');
        const cats = await Category.findAll();
        console.log('Available categories:');
        cats.forEach(c => console.log(`  - ${c.name}`));

        console.log('\n=== PRODUCTS WITH FRIES IN NAME ===');
        const allProds = await Product.findAll({raw: true});
        const friesProds = allProds.filter(p => p.name && p.name.toLowerCase().includes('fries'));
        
        console.log(`Found ${friesProds.length} products with "Fries":`);
        friesProds.forEach(p => {
            console.log(`  - ${p.name}`);
            console.log(`    Category: "${p.category}"`);
            console.log(`    CategoryID: ${p.categoryId}`);
        });

        console.log('\n=== PRODUCT CATEGORY STATISTICS ===');
        const total = await Product.count();
        const withCategory = await Product.count({where: {category: {[require('sequelize').Op.not]: null}}});
        const withoutCategory = total - withCategory;
        
        console.log(`Total products: ${total}`);
        console.log(`With category: ${withCategory}`);
        console.log(`Without category: ${withoutCategory}`);

        console.log('\n=== SAMPLE PRODUCTS (FIRST 5) ===');
        const sample = allProds.slice(0, 5);
        sample.forEach(p => {
            console.log(`  - ${p.name}: category="${p.category}"`);
        });

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error);
    } finally {
        process.exit(0);
    }
}

checkProducts();
