const models = require('../models/sql');
const { Op } = require('sequelize');

(async () => {
    try {
        await models.sequelize.authenticate();
        console.log('✅ Database connected');
        
        // Update first 8 products with stock to be featured
        const [count] = await models.Product.update(
            { featured: true },
            { 
                where: {
                    stock: { [Op.gt]: 0 }
                },
                limit: 8
            }
        );
        
        console.log(`✅ Marked ${count} products as featured`);
        
        // Verify
        const featured = await models.Product.findAll({
            where: { featured: true },
            attributes: ['id', 'name', 'featured']
        });
        console.log(`✅ Total featured products: ${featured.length}`);
        featured.forEach((p, i) => {
            console.log(`   ${i + 1}. ${p.name}`);
        });
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
})();
