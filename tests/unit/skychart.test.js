const request = require('supertest');
const express = require('express');
const skychartsRoutes = require('../../routes/skycharts');
const { createTestUser, testPool } = require('../setup');

// Mock middleware - используем глобальную переменную для user ID
jest.mock('../../middleware/auth', () => {
    return (req, res, next) => {
        req.user = { id: global.currentTestUserId || 1 };
        next();
    };
});

const app = express();
app.use(express.json());
app.use('/api/skycharts', skychartsRoutes);

describe('Skycharts Unit Tests', () => {
    let testUser;

    beforeAll(async () => {
        testUser = await createTestUser();
        // Устанавливаем реальный ID пользователя для middleware
        global.currentTestUserId = testUser.id;
        console.log(`Test user created with ID: ${testUser.id}`);
    });

    afterAll(async () => {
        // Очищаем в правильном порядке из-за foreign key constraints
        try {
            // Сначала удаляем точки скайчартов
            await testPool.query(`
                DELETE FROM skychart_points 
                WHERE skychart_id IN (SELECT id FROM skycharts WHERE user_id = $1)
            `, [testUser.id]);
            
            // Затем удаляем скайчарты
            await testPool.query('DELETE FROM skycharts WHERE user_id = $1', [testUser.id]);
            
            // И наконец пользователя
            await testPool.query('DELETE FROM users WHERE id = $1', [testUser.id]);
            
            console.log('Skychart test data cleaned up successfully');
        } catch (error) {
            console.error('Error cleaning skychart test data:', error);
        }
        
        // Очищаем глобальную переменную
        delete global.currentTestUserId;
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

            console.log('Create skychart response:', {
                status: response.status,
                body: response.body
            });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('skychart');
            expect(response.body.skychart.title).toBe(skychartData.title);
            expect(response.body.skychart.user_id).toBe(testUser.id);
        });

        test('should create skychart without points', async () => {
            const skychartData = {
                title: 'Test Skychart Without Points'
            };

            const response = await request(app)
                .post('/api/skycharts')
                .send(skychartData);

            console.log('Create skychart without points response:', {
                status: response.status,
                body: response.body
            });

            expect(response.status).toBe(201);
            expect(response.body.skychart.title).toBe(skychartData.title);
        });

        test('should fail without title', async () => {
            const response = await request(app)
                .post('/api/skycharts')
                .send({
                    points: JSON.stringify([{ name: 'Star', x: 0.1, y: 0.2, radius: 0.05 }])
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });
    });

    describe('GET /api/skycharts/my', () => {
        test('should return user skycharts', async () => {
            // Сначала создаем скайчарт чтобы было что возвращать
            await request(app)
                .post('/api/skycharts')
                .send({
                    title: 'Skychart for List Test',
                    points: JSON.stringify([{ name: 'Test Star', x: 0.5, y: 0.5, radius: 0.05 }])
                });

            const response = await request(app)
                .get('/api/skycharts/my');

            console.log('Get my skycharts response:', {
                status: response.status,
                count: response.body.skycharts?.length
            });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('skycharts');
            expect(Array.isArray(response.body.skycharts)).toBe(true);
            expect(response.body.skycharts.length).toBeGreaterThan(0);
            
            // Проверяем что скайчарты принадлежат тестовому пользователю
            response.body.skycharts.forEach(skychart => {
                expect(skychart.user_id).toBe(testUser.id);
            });
        });
    });

    describe('GET /api/skycharts/public', () => {
        test('should return public skycharts', async () => {
            const response = await request(app)
                .get('/api/skycharts/public');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('skycharts');
            expect(Array.isArray(response.body.skycharts)).toBe(true);
        });
    });

    describe('GET /api/skycharts/:id', () => {
        test('should return specific skychart', async () => {
            // Сначала создаем скайчарт
            const createResponse = await request(app)
                .post('/api/skycharts')
                .send({
                    title: 'Skychart for Get Test',
                    points: JSON.stringify([
                        { name: 'Get Test Star', x: 0.2, y: 0.3, radius: 0.04 }
                    ])
                });

            const skychartId = createResponse.body.skychart.id;

            // Затем получаем его по ID
            const getResponse = await request(app)
                .get(`/api/skycharts/${skychartId}`);

            console.log('Get specific skychart response:', {
                status: getResponse.status,
                hasPoints: getResponse.body.skychart?.points?.length
            });

            expect(getResponse.status).toBe(200);
            expect(getResponse.body.skychart.id).toBe(skychartId);
            expect(getResponse.body.skychart.title).toBe('Skychart for Get Test');
            expect(Array.isArray(getResponse.body.skychart.points)).toBe(true);
        });

        test('should return 404 for non-existent skychart', async () => {
            const response = await request(app)
                .get('/api/skycharts/99999');

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error');
        });
    });
});