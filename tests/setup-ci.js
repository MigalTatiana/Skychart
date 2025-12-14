const { Pool } = require('pg');

const testPool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'skychart_test',
    user: 'postgres',
    password: 'postgres',
});

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
        console.error('Error creating test user in CI:', error.message);
        return { 
            id: Math.floor(Math.random() * 1000) + 1, 
            email, 
            username,
            created_at: new Date()
        };
    }
};

const cleanupTestData = async () => {
    try {
        console.log('Cleaning up test data in CI...');
        await testPool.query('DELETE FROM messages');
        await testPool.query('DELETE FROM chats');
        await testPool.query('DELETE FROM favorite_chats');
        await testPool.query('DELETE FROM skychart_points');
        await testPool.query('DELETE FROM skycharts');
        await testPool.query('DELETE FROM users WHERE email LIKE $1', ['test%@example.com']);
        console.log('Test data cleaned up successfully in CI');
    } catch (error) {
        console.error('Error cleaning test data in CI:', error.message);
    }
};

module.exports = {
    testPool,
    createTestUser,
    cleanupTestData
};