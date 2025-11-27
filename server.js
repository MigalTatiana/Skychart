const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { specs, swaggerUi } = require('./config/swagger');

const authRoutes = require('./routes/auth');
const skychartsRoutes = require('./routes/skycharts');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use('/api/auth', authRoutes);
app.use('/api/skycharts', skychartsRoutes);
app.get('/api', (req, res) => {
    res.json({ message: 'Learning Platform API is working!' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

const chatsRoutes = require('./routes/chats');
app.use('/api/chats', chatsRoutes);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }'
}));

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app;