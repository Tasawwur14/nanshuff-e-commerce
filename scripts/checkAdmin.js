const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');
const { Admin } = require('../models/sql');

async function checkAdmin() {
    try {
        await sequelize.authenticate();

        const admin = await Admin.findOne({ where: { username: 'NanshhufAdmin' } });
        if (admin) {
            console.log('✅ Admin found!');
            console.log('Username:', admin.username);
            console.log('Email:', admin.email || 'N/A');
            console.log('Password hash exists:', !!admin.password);
            console.log('Password hash length:', admin.password ? admin.password.length : 0);
            const testPassword = 'NanshhufAdmin@1234';
            const isMatch = await bcrypt.compare(testPassword, admin.password);
            console.log('Password matches "NanshhufAdmin@1234":', isMatch);
        } else {
            console.log('❌ Admin NOT found with username "NanshhufAdmin" in SQL DB');
        }
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkAdmin();
