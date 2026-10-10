const models = require('../models/sql');
const Product = models.Product;

async function correctProductCategories() {
    try {
        console.log('Starting proper category assignment...\n');

        // Get all products
        const products = await Product.findAll({raw: true});

        // Define category mappings based on product names
        const categoryMappings = [
            {
                categoryId: 1,
                categoryName: 'French Fries',
                matches: ['French Fries', 'Fries']
            },
            {
                categoryId: 2,
                categoryName: 'Burger Patties',
                matches: ['Burger Patty', 'Patty']
            },
            {
                categoryId: 3,
                categoryName: 'Ready To Eat',
                matches: ['Paratha', 'Ready']
            },
            {
                categoryId: 4,
                categoryName: 'Curries | Marinations | Sauces',
                matches: ['Biryani', 'Butter Chicken', 'Masala', 'Dal Makhani', 'Curry', 'Tikka', 'Tandoori', 'Chole']
            },
            {
                categoryId: 5,
                categoryName: 'Creamy & Dry Cakes',
                matches: ['Cake', 'Rasmalai', 'Gulab', 'Cheesecake']
            },
            {
                categoryId: 6,
                categoryName: 'Breads & Pizza Base',
                matches: ['Bread', 'Roti', 'Naan', 'Pizza Base', 'Kulcha']
            }
        ];

        let updated = 0;
        let skipped = 0;

        for (const product of products) {
            let foundCategory = null;

            // Find matching category
            for (const mapping of categoryMappings) {
                for (const match of mapping.matches) {
                    if (product.name.includes(match)) {
                        foundCategory = {
                            categoryId: mapping.categoryId,
                            categoryName: mapping.categoryName
                        };
                        break;
                    }
                }
                if (foundCategory) break;
            }

            if (foundCategory && product.categoryId !== foundCategory.categoryId) {
                // Update the product
                await Product.update(
                    {
                        categoryId: foundCategory.categoryId,
                        category: foundCategory.categoryName
                    },
                    {where: {id: product.id}}
                );
                console.log(`✓ Fixed: ${product.name} -> ${foundCategory.categoryName} (ID: ${foundCategory.categoryId})`);
                updated++;
            } else if (!foundCategory) {
                console.log(`⚠ Unmatched: ${product.name}`);
                skipped++;
            } else {
                skipped++;
            }
        }

        console.log(`\n=== SUMMARY ===`);
        console.log(`Updated: ${updated}`);
        console.log(`Skipped: ${skipped}`);

        // Verify counts
        console.log(`\n=== VERIFICATION ===`);
        const categories = ['French Fries', 'Burger Patties', 'Ready To Eat', 'Curries | Marinations | Sauces', 'Creamy & Dry Cakes', 'Breads & Pizza Base'];
        
        for (const cat of categories) {
            const count = await Product.count({where: {category: cat}});
            console.log(`${cat}: ${count} products`);
        }

        // Show sample
        console.log(`\n=== SAMPLE VERIFICATION ===`);
        const sample = await Product.findAll({limit: 10, raw: true});
        sample.forEach(p => {
            console.log(`  ${p.name}: ${p.category}`);
        });

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    } finally {
        process.exit(0);
    }
}

correctProductCategories();
