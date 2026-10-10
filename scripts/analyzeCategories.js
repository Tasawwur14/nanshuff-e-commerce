const models = require('../models/sql');
const Product = models.Product;
const Category = models.Category;

async function analyzeProductCategories() {
    try {
        console.log('\n=== ANALYZING PRODUCT-CATEGORY MAPPING ===\n');

        // Get all products with their categoryId
        const products = await Product.findAll({
            raw: true,
            attributes: ['id', 'name', 'categoryId']
        });

        // Get all categories
        const categories = await Category.findAll({
            raw: true,
            attributes: ['id', 'name']
        });

        console.log('Categories:');
        categories.forEach(c => console.log(`  ID ${c.id}: ${c.name}`));

        console.log('\nProducts with likely correct categories based on name:');
        
        // Map products to likely categories based on name matching
        const productsByLikelyCategory = {};
        
        products.forEach(p => {
            let likelyCategory = null;
            const nameLower = p.name.toLowerCase();

            if (nameLower.includes('fries')) {
                likelyCategory = 'French Fries'; // Usually category 1
            } else if (nameLower.includes('burger') || nameLower.includes('patty')) {
                likelyCategory = 'Burger Patties'; // Usually category 2
            } else if (nameLower.includes('biryani') || nameLower.includes('butter chicken') || nameLower.includes('masala') || nameLower.includes('dal') || nameLower.includes('curry') || nameLower.includes('tikka') || nameLower.includes('tandoori') || nameLower.includes('chole')) {
                likelyCategory = 'Curries | Marinations | Sauces'; // Usually category 4
            } else if (nameLower.includes('cake') || nameLower.includes('rasmalai') || nameLower.includes('gulab')) {
                likelyCategory = 'Creamy & Dry Cakes'; // Usually category 5
            } else if (nameLower.includes('bread') || nameLower.includes('roti') || nameLower.includes('naan') || nameLower.includes('pizza')) {
                likelyCategory = 'Breads & Pizza Base'; // Usually category 6
            } else {
                likelyCategory = 'Ready To Eat'; // Default
            }

            if (!productsByLikelyCategory[likelyCategory]) {
                productsByLikelyCategory[likelyCategory] = [];
            }
            productsByLikelyCategory[likelyCategory].push({...p, likelyCategory});
        });

        // Print by likely category
        Object.entries(productsByLikelyCategory).forEach(([category, prods]) => {
            console.log(`\n${category}:`);
            prods.forEach(p => {
                const currentCat = categories.find(c => c.id === p.categoryId);
                console.log(`  - ${p.name} (currently categoryId=${p.categoryId} -> ${currentCat?.name || 'UNKNOWN'})`);
            });
        });

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        process.exit(0);
    }
}

analyzeProductCategories();
