const models = require('./models/sql');
const bcrypt = require('bcryptjs');

async function createUser() {
  try {
    // Check if user already exists
    let user = await models.User.findOne({ where: { email: 'tasawwur@gmail.com' } });
    
    if (user) {
      console.log('User already exists:', user.email);
      return;
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    // Create the user
    user = await models.User.create({
      name: 'Tasawwur Khan',
      email: 'tasawwur@gmail.com',
      password: hashedPassword,
      phone: '1234567890',
      address: 'Sample Address'
    });
    
    console.log('User created successfully:', user.email);
    
  } catch (error) {
    console.error('Error creating user:', error);
  } finally {
    await models.sequelize.close();
  }
}

createUser();