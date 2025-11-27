const request = require('supertest');
const express = require('express');
const chatsRoutes = require('../../routes/chats');
const auth = require('../../middleware/auth');
const { createTestUser, testPool } = require('../setup');

// Mock auth middleware
jest.mock('../../middleware/auth', () => (req, res, next) => {
    req.user = { id: 1 };
    next();
});

const app = express();
app.use(express.json());
app.use('/api/chats', chatsRoutes);

describe('Chats Unit Tests', () => {
    let user1, user2;

    beforeAll(async () => {
        user1 = await createTestUser();
        user2 = await createTestUser();
    });

    afterAll(async () => {
        await testPool.query('DELETE FROM users WHERE id IN ($1, $2)', [user1.id, user2.id]);
    });

    describe('GET /api/chats', () => {
        test('should return user chats', async () => {
            const response = await request(app)
                .get('/api/chats');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('chats');
            expect(response.body).toHaveProperty('favorite_chat');
            expect(Array.isArray(response.body.chats)).toBe(true);
        });
    });

    describe('POST /api/chats', () => {
        test('should create chat between users', async () => {
            const response = await request(app)
                .post('/api/chats')
                .send({ target_user_id: user2.id });

            expect([201, 200]).toContain(response.status);
            expect(response.body).toHaveProperty('chat');
        });
    });

    describe('POST /api/chats/:id/messages', () => {
        test('should send message to chat', async () => {
            // First create a chat
            const chatResponse = await request(app)
                .post('/api/chats')
                .send({ target_user_id: user2.id });

            const chatId = chatResponse.body.chat.id;

            const messageResponse = await request(app)
                .post(`/api/chats/${chatId}/messages`)
                .send({ content: 'Test message' });

            expect(messageResponse.status).toBe(201);
            expect(messageResponse.body).toHaveProperty('message');
            expect(messageResponse.body.message.content).toBe('Test message');
        });
    });
});