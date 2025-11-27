const request = require('supertest');
const express = require('express');
const skychartsRoutes = require('../../routes/skycharts');
const auth = require('../../middleware/auth');
const { createTestUser, testPool } = require('../setup');

// Mock auth middleware for testing
jest.mock('../../middleware/auth', () => (req, res, next) => {
    req.user = { id: 1 }; // Mock user ID
    next();
});

const app = express();
app.use(express.json());
app.use('/api/skycharts', skychartsRoutes);

describe('Skycharts Unit Tests', () => {
    let testUser;

    beforeAll(async () => {
        testUser = await createTestUser();
    });

    afterAll(async () => {
        await testPool.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    });

    describe('POST /api/skycharts', () => {
        test('should create skychart successfully', async () => {
            const skychartData = {
                title: 'Test Skychart',
                points: JSON.stringify([
                    { name: 'Star A', x: 0.1, y: 0.2, radius: 0.05 },
                    { name: 'Star B', x: 0.3, y: 0.4, radius: 0.03 }
                ])
            };

            const response = await request(app)
                .post('/api/skycharts')
                .send(skychartData);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('skychart');
            expect(response.body.skychart.title).toBe(skychartData.title);
        });

        test('should fail without title', async () => {
            const response = await request(app)
                .post('/api/skycharts')
                .send({
                    points: JSON.stringify([{ name: 'Star', x: 0.1, y: 0.2, radius: 0.05 }])
                });

            expect(response.status).toBe(400);
        });
    });

    describe('GET /api/skycharts/my', () => {
        test('should return user skycharts', async () => {
            const response = await request(app)
                .get('/api/skycharts/my');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('skycharts');
            expect(Array.isArray(response.body.skycharts)).toBe(true);
        });
    });
});