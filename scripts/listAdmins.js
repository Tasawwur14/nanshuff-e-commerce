const { sequelize } = require('../config/database');
const { Admin } = require('../models/sql');
const bcrypt = require('bcryptjs');

async function listAdmins() {
    try {
        await sequelize.authenticate();
        const admins = await Admin.findAll();
        if (!admins || admins.length === 0) {
            console.log('❌ No admins found in the SQL database!\n');
        } else {
            console.log(`📊 Found ${admins.length} admin(s):\n`);
            for (const admin of admins) {
                console.log(`👤 Username: ${admin.username}`);
                console.log(`📧 Email: ${admin.email}`);
                console.log(`🔑 Password Hash: ${String(admin.password).substring(0, 20)}...`);
                console.log(`📏 Hash Length: ${String(admin.password).length}`);
                if (admin.username === 'NanshhufAdmin') {
                    console.log('\n🔍 Testing password "NanshhufAdmin@1234"...');
                    const isMatch = await bcrypt.compare('NanshhufAdmin@1234', admin.password);
                    console.log(`Password match: ${isMatch ? '✅ YES' : '❌ NO'}`);
                }
                console.log('-----------------------------------\n');
            }
        }
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

listAdmins();
