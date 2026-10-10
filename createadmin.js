// --- This script is used to create a new admin user in the database ---

const bcrypt = require('bcryptjs');
require('dotenv').config();
const { sequelize } = require('./config/database');
const { Admin } = require('./models/sql');

const createAdmin = async () => {
    try {
        const username = process.argv[2];
        const password = process.argv[3];

        if (!username || !password) {
            console.log('❗️Incorrect usage! Use: node createadmin.js <username> <password>');
            return;
        }

        await sequelize.authenticate();

        const existing = await Admin.findOne({ where: { username } });
        if (existing) {
            existing.password = password;
            await existing.save();
            console.log(`✅ Admin user '${username}' already exists. Password has been updated successfully!`);
            process.exit(0);
        }

        // Pass plain password so the Admin beforeCreate hook hashes it exactly once
        await Admin.create({ username, password });
        console.log(`✅ Admin user '${username}' created successfully in SQL DB!`);
        process.exit(0);


    } catch (error) {
        console.error('❌ Error creating admin:', error);
        process.exit(1);
    }
};

createAdmin();

