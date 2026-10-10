// --- Script to update an existing admin password in the database ---

require('dotenv').config();
const { sequelize } = require('./config/database');
const { Admin } = require('./models/sql');

const updateAdmin = async () => {
    try {
        const username = process.argv[2];
        const newPassword = process.argv[3];

        if (!username || !newPassword) {
            console.log('❗️Incorrect usage! Use: node updateadmin.js <username> <new_password>');
            process.exit(1);
        }

        await sequelize.authenticate();

        const admin = await Admin.findOne({ where: { username } });
        if (!admin) {
            console.log(`❗️Admin user '${username}' not found.`);
            process.exit(1);
        }

        admin.password = newPassword;
        await admin.save();
        console.log(`✅ Admin user '${username}' password updated successfully!`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating admin password:', error);
        process.exit(1);
    }
};

updateAdmin();
