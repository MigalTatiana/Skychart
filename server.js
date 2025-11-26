const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const skychartsRoutes = require('./routes/skycharts');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/skycharts', skychartsRoutes);
// Basic route
app.get('/api', (req, res) => {
    res.json({ message: 'Learning Platform API is working!' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
