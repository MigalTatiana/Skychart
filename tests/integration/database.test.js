const { testPool } = require('../setup');

describe('Database Integration Tests', () => {
    test('should connect to database successfully', async () => {
        const result = await testPool.query('SELECT 1 as test');
        expect(result.rows[0].test).toBe(1);
    });

    test('should handle user creation and deletion', async () => {
        const email = `dbtest${Date.now()}@example.com`;
        const insertResult = await testPool.query(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
            [email, 'test_hash']
        );

        expect(insertResult.rows[0].email).toBe(email);

        const userId = insertResult.rows[0].id;
        const selectResult = await testPool.query(
            'SELECT * FROM users WHERE id = $1',
            [userId]
        );

        expect(selectResult.rows[0].id).toBe(userId);
        await testPool.query('DELETE FROM users WHERE id = $1', [userId]);
    });

    test('should maintain referential integrity', async () => {
        await expect(
            testPool.query('INSERT INTO skycharts (user_id, title) VALUES ($1, $2)', [99999, 'Test'])
        ).rejects.toThrow();
    });
});