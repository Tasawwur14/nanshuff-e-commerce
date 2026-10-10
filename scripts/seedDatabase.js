// Seed script to populate products and categories
const { sequelize } = require('../config/database');
const sqlModels = require('../models/sql');

const { Category, Product } = sqlModels;

async function seedDatabase() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected');

        // Clear existing data
        await Product.destroy({ where: {} });
        await Category.destroy({ where: {} });
        console.log('✅ Cleared existing data');

        // Create categories
        const categories = await Category.bulkCreate([
            { name: 'French Fries', image: '/images/french-fries.png' },
            { name: 'Burger Patties', image: '/images/burgerpatties.png' },
            { name: 'Ready To Eat', image: '/images/readytoeat.png' },
            { name: 'Curries | Marinations | Sauces', image: '/images/sauce.jpeg' },
            { name: 'Creamy & Dry Cakes', image: '/images/cake.png' },
            { name: 'Breads & Pizza Base', image: '/images/breadandbase.png' },
        ]);
        console.log(`✅ Created ${categories.length} categories`);

        // Create products
        const products = [];
        const productNames = [
            'Garlic Bread 250g',
            'Paratha Pack 400g',
            'Naan Bread Pack 300g',
            'French Fries Crinkle Cut 400g',
            'French Fries Straight Cut 500g',
            'Cheese Loaded Fries 350g',
            'Spicy French Fries 400g',
            'Sweet Corn Fries 300g',
            'Chicken Tikka Burger Patty 300g',
            'Paneer Tikka Patty 250g',
            'Vegetable Burger Patty 280g',
            'Tandoori Chicken Patty 320g',
            'Butter Chicken Biryani 400g',
            'Paneer Butter Masala Pack 350g',
            'Dal Makhani Curry 300g',
            'Tandoori Chicken Masala 350g',
            'Tandoori Paneer 300g',
            'Chole Bhature Mix 500g',
            'Red Velvet Cake 500g',
            'Black Forest Cake 600g',
            'Brownie Cake 400g',
            'Vanilla Cake 500g',
            'Chocolate Cake 500g',
            'Cheesecake Pack 300g',
            'Rasmalai 250g',
            'Gulab Jamun Pack 300g',
            'Pizza Base Thin Crust 300g',
            'Pizza Base Thick Crust 400g',
            'Naan Kulcha Mix 400g',
            'Tandoori Roti Pack 250g',
        ];

        for (let i = 0; i < productNames.length; i++) {
            products.push({
                name: productNames[i],
                description: `Premium quality frozen ${productNames[i].toLowerCase()}`,
                price: 50 + Math.random() * 150,
                stock: Math.floor(Math.random() * 100) + 10,
                categoryId: categories[i % categories.length].id,
                imageUrl: '/images/french-fries.png', // Using same image for all
                sku: `SKU-${String(i + 1).padStart(4, '0')}`,
            });
        }

        const createdProducts = await Product.bulkCreate(products);
        console.log(`✅ Created ${createdProducts.length} products`);

        console.log('✅ Database seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding error:', error);
        process.exit(1);
    }
}

seedDatabase();
