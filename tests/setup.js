const { Pool } = require('pg');
require('dotenv').config();

// Тестовая база данных
const TEST_DB_NAME = 'auth_project_test';

const testPool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: TEST_DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

// Глобальные тестовые переменные
global.testUsers = [];
global.testSkycharts = [];
global.testChats = [];

// Утилиты для тестов
global.createTestUser = async () => {
    const email = `test${Date.now()}@example.com`;
    const result = await testPool.query(
        'INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING *',
        [email, 'hashed_password', `user${Date.now()}`]
    );
    global.testUsers.push(result.rows[0]);
    return result.rows[0];
};

global.cleanupTestData = async () => {
    for (const user of global.testUsers) {
        await testPool.query('DELETE FROM users WHERE id = $1', [user.id]);
    }
    global.testUsers = [];
    global.testSkycharts = [];
    global.testChats = [];
};

module.exports = {
    testPool,
    TEST_DB_NAME
};