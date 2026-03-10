const User = require('./models/User');

const seedAdmin = async () => {
    try {
        const adminExists = await User.findOne({ email: 'admin@shopnobatihor.com' });
        if (!adminExists) {
            await User.create({
                name: 'System Admin',
                email: 'admin@shopnobatihor.com',
                password: 'admin123',
                role: 'Admin',
            });
            console.log('Default Admin seeded: admin@shopnobatihor.com / admin123');
        }
    } catch (error) {
        console.error(`Admin seeding error: ${error.message}`);
    }
};

module.exports = seedAdmin;
