require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./config/db');
const seedAdmin = require('./seed');

// Connect to Database
connectDB().then(() => {
    seedAdmin();
});

const app = express();

// Middlewares
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'https://robiul-vai.vercel.app', 'https://investment-erp.onrender.com', 'https://erp-i.vercel.app'],
    credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/members', require('./routes/memberRoutes'));
app.use('/api/deposits', require('./routes/depositRoutes'));
app.use('/api/withdrawals', require('./routes/withdrawalRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/logs', require('./routes/logRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/distributions', require('./routes/distributionRoutes'));

app.get('/', (req, res) => {
    res.send('স্বপ্নের বাতিঘর এপিআই ইজ রানিং...'); // স্বপ্নের বাতিঘর API is running...
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
