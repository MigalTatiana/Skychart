const express = require('express');
const auth = require('../middleware/auth');
const router = express.Router();
const pool = require('../config/database');
const upload = require('../middleware/upload');
const fs = require('fs').promises;
const path = require('path');

const createSkychartHandler = async (req, res) => {
    const client = await pool.connect();

    try {
        const userId = req.user.id;
        const { title } = req.body;
        const isPublic = req.body.is_public === 'true' || req.body.is_public === true;
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

        let points = [];
        if (req.body.points) {
            try {
                const parsedPoints = JSON.parse(req.body.points);
                if (Array.isArray(parsedPoints)) {
                    points = parsedPoints;
                }
            } catch (err) {
                return res.status(400).json({ error: 'Invalid points format' });
            }
        }

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        await client.query('BEGIN');

        const skychartResult = await client.query(
            `INSERT INTO skycharts (title, user_id, is_public, image_url)
             VALUES ($1, $2, $3, $4)
             RETURNING id, title, user_id, is_public, image_url, created_at, updated_at`,
            [title, userId, !!isPublic, imageUrl]
        );

        const skychart = skychartResult.rows[0];

        if (Array.isArray(points) && points.length > 0) {
            const insertValues = [];
            const params = [];

            points.forEach((p, index) => {
                const base = index * 5;
                params.push(
                    p.x,
                    p.y,
                    p.radius,
                    p.name || `Point ${index + 1}`,
                    skychart.id
                );
                insertValues.push(
                    `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`
                );
            });

            await client.query(
                `INSERT INTO skychart_points (x, y, radius, name, skychart_id)
                 VALUES ${insertValues.join(', ')}`,
                params
            );
        }

        await client.query('COMMIT');

        const pointsResult = await pool.query(
            `SELECT id, x, y, radius, name
             FROM skychart_points
             WHERE skychart_id = $1
             ORDER BY id`,
            [skychart.id]
        );

        res.status(201).json({
            message: 'Skychart created successfully',
            skychart: {
                ...skychart,
                points: pointsResult.rows
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create skychart error:', error);
        
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        }
        
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
};

/**
 * @swagger
 * /api/skycharts:
 *   post:
 *     summary: Создать новый скайчарт
 *     tags: [Skycharts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 example: My Star Chart
 *               is_public:
 *                 type: boolean
 *                 example: false
 *               points:
 *                 type: string
 *                 description: JSON string массива точек
 *                 example: '[{"name":"Star A","x":0.1,"y":0.2,"radius":0.05}]'
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Скайчарт успешно создан
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Skychart created successfully
 *                 skychart:
 *                   $ref: '#/components/schemas/Skychart'
 *       400:
 *         description: Ошибка валидации
 *       401:
 *         description: Неавторизован
 */
router.post('/', auth, upload.single('image'), createSkychartHandler);
router.post('/create', auth, upload.single('image'), createSkychartHandler);

/**
 * @swagger
 * /api/skycharts/public:
 *   get:
 *     summary: Получить публичные скайчарты
 *     tags: [Skycharts]
 *     responses:
 *       200:
 *         description: Список публичных скайчартов
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 skycharts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Skychart'
 */
router.get('/public', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                s.id,
                s.title,
                s.user_id,
                s.is_public,
                s.image_url,
                s.created_at,
                s.updated_at,
                u.username,
                u.email
             FROM skycharts s
             JOIN users u ON s.user_id = u.id
             WHERE s.is_public = TRUE
             ORDER BY s.created_at DESC`
        );

        res.json({ skycharts: result.rows });
    } catch (error) {
        console.error('Get public skycharts error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/skycharts/my:
 *   get:
 *     summary: Получить скайчарты текущего пользователя
 *     tags: [Skycharts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список скайчартов пользователя
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 skycharts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Skychart'
 *       401:
 *         description: Неавторизован
 */
router.get('/my', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            `SELECT
                s.id,
                s.title,
                s.user_id,
                s.is_public,
                s.image_url,
                s.created_at,
                s.updated_at,
                COUNT(sp.id) as points_count
             FROM skycharts s
             LEFT JOIN skychart_points sp ON s.id = sp.skychart_id
             WHERE s.user_id = $1
             GROUP BY s.id, s.title, s.user_id, s.is_public, s.image_url, s.created_at, s.updated_at
             ORDER BY s.created_at DESC`,
            [userId]
        );

        res.json({ skycharts: result.rows });
    } catch (error) {
        console.error('Get my skycharts error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/skycharts/{id}:
 *   get:
 *     summary: Получить скайчарт по ID
 *     tags: [Skycharts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID скайчарта
 *     responses:
 *       200:
 *         description: Данные скайчарта
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 skychart:
 *                   $ref: '#/components/schemas/Skychart'
 *       404:
 *         description: Скайчарт не найден
 */
router.get('/:id', async (req, res) => {
    try {
        const chartId = req.params.id;

        const chartResult = await pool.query(
            `SELECT
                s.id,
                s.title,
                s.user_id,
                s.is_public,
                s.image_url,
                s.created_at,
                s.updated_at,
                u.username,
                u.email
             FROM skycharts s
             JOIN users u ON s.user_id = u.id
             WHERE s.id = $1`,
            [chartId]
        );

        if (chartResult.rows.length === 0) {
            return res.status(404).json({ error: 'Skychart not found' });
        }

        const pointsResult = await pool.query(
            `SELECT id, x, y, radius, name
             FROM skychart_points
             WHERE skychart_id = $1
             ORDER BY id`,
            [chartId]
        );

        res.json({
            skychart: {
                ...chartResult.rows[0],
                points: pointsResult.rows
            }
        });
    } catch (error) {
        console.error('Get skychart by id error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/skycharts/{id}:
 *   delete:
 *     summary: Удалить скайчарт
 *     tags: [Skycharts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID скайчарта
 *     responses:
 *       200:
 *         description: Скайчарт удален
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Skychart deleted successfully
 *       403:
 *         description: Нет прав для удаления
 *       404:
 *         description: Скайчарт не найден
 */
router.delete('/:id', auth, async (req, res) => {
    const client = await pool.connect();

    try {
        const chartId = req.params.id;
        const userId = req.user.id;

        const chartResult = await pool.query(
            `SELECT id, user_id, image_url
             FROM skycharts
             WHERE id = $1`,
            [chartId]
        );

        if (chartResult.rows.length === 0) {
            return res.status(404).json({ error: 'Skychart not found' });
        }

        if (chartResult.rows[0].user_id !== userId) {
            return res.status(403).json({ error: 'Forbidden: not your skychart' });
        }

        const imageUrl = chartResult.rows[0].image_url;

        await client.query('BEGIN');

        await client.query(
            `DELETE FROM skycharts
             WHERE id = $1`,
            [chartId]
        );

        await client.query('COMMIT');

        if (imageUrl) {
            try {
                const filename = path.basename(imageUrl);
                const filePath = path.join(__dirname, '../uploads', filename);

                try {
                    await fs.access(filePath);
                    await fs.unlink(filePath);
                    console.log(`Удален файл изображения: ${filename}`);
                } catch (fileError) {
                    if (fileError.code === 'ENOENT') {
                        console.log(`Файл не найден: ${filename}`);
                    } else {
                        console.error('Ошибка при удалении файла:', fileError);
                    }
                }
            } catch (fileError) {
                console.error('Ошибка при обработке файла:', fileError);
            }
        }

        res.json({ 
            message: 'Skychart deleted successfully'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Delete skychart error:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

router.post('/:id/check', auth, async (req, res) => {
    try {
        const chartId = req.params.id;
        const { placements } = req.body;
        const userId = req.user.id;

        const chartResult = await pool.query(
            `SELECT s.id, s.user_id, 
                    json_agg(json_build_object(
                        'id', sp.id,
                        'x', sp.x,
                        'y', sp.y,
                        'radius', sp.radius,
                        'name', sp.name
                    )) as points
             FROM skycharts s
             LEFT JOIN skychart_points sp ON s.id = sp.skychart_id
             WHERE s.id = $1
             GROUP BY s.id, s.user_id`,
            [chartId]
        );

        if (chartResult.rows.length === 0) {
            return res.status(404).json({ error: 'Skychart not found' });
        }

        const chart = chartResult.rows[0];
        const points = chart.points[0] ? chart.points : [];

        let correct = 0;
        let incorrect = 0;
        const placementResults = {};

        points.forEach(point => {
            const userPlacement = placements[point.id];
            let isCorrect = false;

            if (userPlacement) {
                const distance = Math.sqrt(
                    Math.pow(userPlacement.x - point.x, 2) + 
                    Math.pow(userPlacement.y - point.y, 2)
                );
                
                isCorrect = distance <= point.radius;
            }

            if (isCorrect) {
                correct++;
            } else {
                incorrect++;
            }

            placementResults[point.id] = {
                correct: isCorrect,
                userX: userPlacement?.x,
                userY: userPlacement?.y,
                actualX: point.x,
                actualY: point.y,
                distance: userPlacement ? Math.sqrt(
                    Math.pow(userPlacement.x - point.x, 2) + 
                    Math.pow(userPlacement.y - point.y, 2)
                ) : null
            };
        });

        const total = points.length;
        const score = total > 0 ? Math.round((correct / total) * 100) : 0;

        await pool.query(
            `INSERT INTO skychart_attempts (user_id, skychart_id, score, correct_count, total_count)
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, chartId, score, correct, total]
        );

        res.json({
            correct,
            incorrect,
            total,
            score,
            placements: placementResults
        });

    } catch (error) {
        console.error('Check placements error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/:id', auth, upload.single('image'), async (req, res) => {
    const client = await pool.connect();

    try {
        const skychartId = req.params.id;
        const userId = req.user.id;
        const { title } = req.body;

        const existingChart = await pool.query(
            `SELECT id, user_id, image_url FROM skycharts WHERE id = $1`,
            [skychartId]
        );

        if (existingChart.rows.length === 0) {
            return res.status(404).json({ error: 'Skychart not found' });
        }

        if (existingChart.rows[0].user_id !== userId) {
            return res.status(403).json({ error: 'Forbidden: not your skychart' });
        }

        let points = [];
        if (req.body.points) {
            try {
                const parsedPoints = JSON.parse(req.body.points);
                if (Array.isArray(parsedPoints)) {
                    points = parsedPoints;
                }
            } catch (err) {
                return res.status(400).json({ error: 'Invalid points format' });
            }
        }

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }
        let imageUrl = existingChart.rows[0].image_url;
        if (req.file) {
            imageUrl = `/uploads/${req.file.filename}`;
            if (existingChart.rows[0].image_url) {
                try {
                    const oldFilename = path.basename(existingChart.rows[0].image_url);
                    const oldFilePath = path.join(__dirname, '../uploads', oldFilename);
                    await fs.unlink(oldFilePath).catch(() => {});
                } catch (fileError) {
                    console.error('Error deleting old image:', fileError);
                }
            }
        }

        await client.query('BEGIN');
        const skychartResult = await client.query(
            `UPDATE skycharts 
             SET title = $1, image_url = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING id, title, user_id, is_public, image_url, created_at, updated_at`,
            [title, imageUrl, skychartId]
        );

        const skychart = skychartResult.rows[0];
        await client.query(
            `DELETE FROM skychart_points WHERE skychart_id = $1`,
            [skychartId]
        );

        if (Array.isArray(points) && points.length > 0) {
            const insertValues = [];
            const params = [];

            points.forEach((p, index) => {
                const base = index * 5;
                params.push(
                    p.x,
                    p.y,
                    p.radius,
                    p.name || `Point ${index + 1}`,
                    skychart.id
                );
                insertValues.push(
                    `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`
                );
            });

            await client.query(
                `INSERT INTO skychart_points (x, y, radius, name, skychart_id)
                 VALUES ${insertValues.join(', ')}`,
                params
            );
        }

        await client.query('COMMIT');
        const pointsResult = await pool.query(
            `SELECT id, x, y, radius, name
             FROM skychart_points
             WHERE skychart_id = $1
             ORDER BY id`,
            [skychart.id]
        );

        res.json({
            message: 'Skychart updated successfully',
            skychart: {
                ...skychart,
                points: pointsResult.rows
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Update skychart error:', error);
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        }
        
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

module.exports = router;