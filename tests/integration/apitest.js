const request = require('supertest');
const app = require('../../server'); // Ваш Express app
const { createTestUser, testPool } = require('../setup');

describe('API Integration Tests', () => {
    let testUser;
    let authToken;

    beforeAll(async () => {
        testUser = await createTestUser();
        
        // Получаем токен для аутентифицированных запросов
        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: testUser.email,
                password: 'password123'
            });

        authToken = loginResponse.body.token;
    });

    afterAll(async () => {
        await testPool.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    });

    describe('Skycharts API Flow', () => {
        test('complete skychart creation flow', async () => {
            // 1. Create skychart
            const createResponse = await request(app)
                .post('/api/skycharts')
                .set('Authorization', `Bearer ${authToken}`)
                .field('title', 'Integration Test Skychart')
                .field('points', JSON.stringify([
                    { name: 'Integration Star', x: 0.5, y: 0.5, radius: 0.05 }
                ]));

            expect(createResponse.status).toBe(201);
            const skychartId = createResponse.body.skychart.id;

            // 2. Get user skycharts
            const listResponse = await request(app)
                .get('/api/skycharts/my')
                .set('Authorization', `Bearer ${authToken}`);

            expect(listResponse.status).toBe(200);
            expect(listResponse.body.skycharts.length).toBeGreaterThan(0);

            // 3. Get specific skychart
            const getResponse = await request(app)
                .get(`/api/skycharts/${skychartId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(getResponse.status).toBe(200);
            expect(getResponse.body.skychart.id).toBe(skychartId);

            // 4. Delete skychart
            const deleteResponse = await request(app)
                .delete(`/api/skycharts/${skychartId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(deleteResponse.status).toBe(200);
        });
    });

    describe('Chats API Flow', () => {
        let otherUser;
        let chatId;

        beforeAll(async () => {
            otherUser = await createTestUser();
        });

        afterAll(async () => {
            await testPool.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
        });

        test('complete chat flow', async () => {
            // 1. Create chat
            const chatResponse = await request(app)
                .post('/api/chats')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ target_user_id: otherUser.id });

            expect(chatResponse.status).toBe(201);
            chatId = chatResponse.body.chat.id;

            // 2. Send message
            const messageResponse = await request(app)
                .post(`/api/chats/${chatId}/messages`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ content: 'Integration test message' });

            expect(messageResponse.status).toBe(201);

            // 3. Get messages
            const messagesResponse = await request(app)
                .get(`/api/chats/${chatId}/messages`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(messagesResponse.status).toBe(200);
            expect(messagesResponse.body.messages.length).toBeGreaterThan(0);
        });
    });
});