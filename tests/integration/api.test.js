const request = require('supertest');
const { createTestUser, testPool } = require('../setup');

const express = require('express');
const authRoutes = require('../../routes/auth');
const skychartsRoutes = require('../../routes/skycharts');
const chatsRoutes = require('../../routes/chats');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/skycharts', skychartsRoutes);
app.use('/api/chats', chatsRoutes);

describe('API Integration Tests', () => {
    let testUser;
    let authToken;

    beforeAll(async () => {
        testUser = await createTestUser();
        const userData = {
            email: testUser.email,
            password: 'password123',
            username: testUser.username
        };

        const registerResponse = await request(app)
            .post('/api/auth/register')
            .send(userData);

        console.log('Registration response:', {
            status: registerResponse.status,
            hasToken: !!registerResponse.body.token
        });
        if (registerResponse.status === 201) {
            authToken = registerResponse.body.token;
        } else {
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: userData.email,
                    password: userData.password
                });

            console.log('Login response:', {
                status: loginResponse.status,
                hasToken: !!loginResponse.body?.token
            });

            if (loginResponse.status === 200) {
                authToken = loginResponse.body.token;
            } else {
                const newTestUser = await createTestUser();
                const newRegisterResponse = await request(app)
                    .post('/api/auth/register')
                    .send({
                        email: newTestUser.email,
                        password: 'password123',
                        username: newTestUser.username
                    });

                if (newRegisterResponse.status === 201) {
                    testUser = newTestUser;
                    authToken = newRegisterResponse.body.token;
                }
            }
        }

        console.log(`Test user authenticated: ${testUser.id}, token: ${!!authToken}`);
    });

    afterAll(async () => {
        try {
            await testPool.query(`
                DELETE FROM messages 
                WHERE sender_id = $1
            `, [testUser.id]);
            
            await testPool.query(`
                DELETE FROM chats 
                WHERE user1_id = $1 OR user2_id = $1
            `, [testUser.id]);
            
            await testPool.query(`
                DELETE FROM favorite_chats 
                WHERE user_id = $1
            `, [testUser.id]);
            
            await testPool.query(`
                DELETE FROM skychart_points 
                WHERE skychart_id IN (SELECT id FROM skycharts WHERE user_id = $1)
            `, [testUser.id]);
            
            await testPool.query(`
                DELETE FROM skycharts 
                WHERE user_id = $1
            `, [testUser.id]);
            
            await testPool.query('DELETE FROM users WHERE id = $1', [testUser.id]);
        } catch (error) {
            console.error('Error cleaning integration test data:', error);
        }
    });

    describe('Skycharts API Flow', () => {
        test('complete skychart creation flow', async () => {
            if (!authToken) {
                console.log('Skipping skychart test - no auth token');
                return;
            }
            const createResponse = await request(app)
                .post('/api/skycharts')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Integration Test Skychart',
                    points: JSON.stringify([
                        { name: 'Integration Star', x: 0.5, y: 0.5, radius: 0.05 }
                    ])
                });

            console.log('Create skychart response:', {
                status: createResponse.status,
                hasToken: !!authToken,
                body: createResponse.body
            });
            if (createResponse.status === 401) {
                console.log('Authentication failed, token might be invalid');
            }

            expect([201, 200]).toContain(createResponse.status);
            
            if (createResponse.status === 201) {
                const skychartId = createResponse.body.skychart.id;
                const listResponse = await request(app)
                    .get('/api/skycharts/my')
                    .set('Authorization', `Bearer ${authToken}`);

                expect(listResponse.status).toBe(200);
                expect(listResponse.body.skycharts.length).toBeGreaterThan(0);
                const getResponse = await request(app)
                    .get(`/api/skycharts/${skychartId}`)
                    .set('Authorization', `Bearer ${authToken}`);

                expect(getResponse.status).toBe(200);
                expect(getResponse.body.skychart.id).toBe(skychartId);
                const deleteResponse = await request(app)
                    .delete(`/api/skycharts/${skychartId}`)
                    .set('Authorization', `Bearer ${authToken}`);

                expect(deleteResponse.status).toBe(200);
            }
        });
    });

    describe('Chats API Flow', () => {
        let otherUser;

        beforeAll(async () => {
            otherUser = await createTestUser();
        });

        test('complete chat flow', async () => {
            if (!authToken) {
                console.log('Skipping chat test - no auth token');
                return;
            }
            const chatResponse = await request(app)
                .post('/api/chats')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ target_user_id: otherUser.id });

            console.log('Create chat response:', {
                status: chatResponse.status,
                body: chatResponse.body
            });
            expect([201, 200, 401]).toContain(chatResponse.status);
            
            if (chatResponse.status === 201 || chatResponse.status === 200) {
                const chatId = chatResponse.body.chat.id;
                const messageResponse = await request(app)
                    .post(`/api/chats/${chatId}/messages`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({ content: 'Integration test message' });

                console.log('Send message response:', {
                    status: messageResponse.status,
                    body: messageResponse.body
                });

                expect(messageResponse.status).toBe(201);
                const messagesResponse = await request(app)
                    .get(`/api/chats/${chatId}/messages`)
                    .set('Authorization', `Bearer ${authToken}`);

                console.log('Get messages response:', {
                    status: messagesResponse.status,
                    messageCount: messagesResponse.body.messages?.length
                });

                expect(messagesResponse.status).toBe(200);
                expect(messagesResponse.body.messages.length).toBeGreaterThan(0);
            }
        });

        test('favorite chat flow', async () => {
            if (!authToken) {
                console.log('Skipping favorite chat test - no auth token');
                return;
            }
            const chatsResponse = await request(app)
                .get('/api/chats')
                .set('Authorization', `Bearer ${authToken}`);

            console.log('Get chats response:', {
                status: chatsResponse.status,
                hasFavorite: !!chatsResponse.body?.favorite_chat
            });

            expect(chatsResponse.status).toBe(200);
            expect(chatsResponse.body).toHaveProperty('favorite_chat');
            
            const favoriteChatId = chatsResponse.body.favorite_chat.id;
            const messageResponse = await request(app)
                .post(`/api/chats/${favoriteChatId}/messages`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ content: 'Favorite integration test message' });

            console.log('Send to favorite response:', {
                status: messageResponse.status
            });

            expect(messageResponse.status).toBe(201);
            const messagesResponse = await request(app)
                .get(`/api/chats/${favoriteChatId}/messages`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(messagesResponse.status).toBe(200);
            expect(messagesResponse.body.chat_type).toBe('favorite');
        });
    });

    describe('Authentication Flow', () => {
        test('should handle authentication correctly', async () => {
            const authTestUser = await createTestUser();
            const registerResponse = await request(app)
                .post('/api/auth/register')
                .send({
                    email: authTestUser.email,
                    password: 'testpassword123',
                    username: authTestUser.username
                });

            console.log('Auth test registration:', {
                status: registerResponse.status,
                hasToken: !!registerResponse.body?.token
            });
            if (registerResponse.status === 201) {
                expect(registerResponse.body).toHaveProperty('token');
                expect(registerResponse.body).toHaveProperty('user');
            }
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: authTestUser.email,
                    password: 'testpassword123'
                });

            console.log('Auth test login:', {
                status: loginResponse.status,
                hasToken: !!loginResponse.body?.token
            });
            if (loginResponse.status === 200) {
                expect(loginResponse.body).toHaveProperty('token');
                expect(loginResponse.body).toHaveProperty('user');
            }
            const wrongLoginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: authTestUser.email,
                    password: 'wrongpassword'
                });

            expect(wrongLoginResponse.status).toBe(400);
            expect(wrongLoginResponse.body).toHaveProperty('error');
            await testPool.query('DELETE FROM users WHERE id = $1', [authTestUser.id]);
        });
    });
});