(async () => {
  process.env.DB_TYPE = process.env.DB_TYPE || 'sqlite';
  const { sequelize } = require('../config/database');
  const sqlModels = require('../models/sql');
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    const username = process.argv[2] || 'NanshhufAdmin';
    const password = process.argv[3] || 'NanshhufAdmin@1234';
    const existing = await sqlModels.Admin.findOne({ where: { username } });
    if (existing) {
      console.log('Admin already exists:', existing.username);
      process.exit(0);
    }
    const admin = await sqlModels.Admin.create({ username, password });
    console.log('Created SQL admin:', { id: admin.id, username: admin.username });
    process.exit(0);
  } catch (e) {
    console.error('Error creating SQL admin', e);
    process.exit(1);
  }
})();