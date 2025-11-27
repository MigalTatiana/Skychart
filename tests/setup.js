const { Pool } = require('pg');
require('dotenv').config();

// Используем основную базу данных для тестов
const TEST_DB_NAME = process.env.DB_NAME || 'auth_project';

const testPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: TEST_DB_NAME,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
});

// Утилиты для тестов
const createTestUser = async () => {
    const email = `test${Date.now()}@example.com`;
    const username = `testuser${Date.now()}`;
    try {
        const result = await testPool.query(
            'INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING *',
            [email, '$2a$10$fakehashfortesting', username]
        );
        console.log(`Created test user: ${email} with ID: ${result.rows[0].id}`);
        return result.rows[0];
    } catch (error) {
        console.error('Error creating test user:', error);
        throw error;
    }
};

const cleanupTestData = async () => {
    try {
        // Удаляем в правильном порядке из-за foreign key constraints
        await testPool.query(`
            DELETE FROM messages 
            WHERE sender_id IN (SELECT id FROM users WHERE email LIKE 'test%@example.com')
            OR chat_id IN (SELECT id FROM chats WHERE user1_id IN (SELECT id FROM users WHERE email LIKE 'test%@example.com') OR user2_id IN (SELECT id FROM users WHERE email LIKE 'test%@example.com'))
            OR favorite_chat_id IN (SELECT id FROM favorite_chats WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test%@example.com'))
        `);
        
        await testPool.query(`
            DELETE FROM chats 
            WHERE user1_id IN (SELECT id FROM users WHERE email LIKE 'test%@example.com') 
            OR user2_id IN (SELECT id FROM users WHERE email LIKE 'test%@example.com')
        `);
        
        await testPool.query(`
            DELETE FROM favorite_chats 
            WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test%@example.com')
        `);
        
        await testPool.query(`
            DELETE FROM skychart_points 
            WHERE skychart_id IN (SELECT id FROM skycharts WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test%@example.com'))
        `);
        
        await testPool.query(`
            DELETE FROM skycharts 
            WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test%@example.com')
        `);
        
        await testPool.query(`DELETE FROM users WHERE email LIKE 'test%@example.com'`);
        
        console.log('Test data cleaned up successfully');
    } catch (error) {
        console.error('Error cleaning test data:', error);
    }
};

// Глобальная очистка перед выходом
process.on('exit', async () => {
    await cleanupTestData();
});

module.exports = {
    testPool,
    createTestUser,
    cleanupTestData
};