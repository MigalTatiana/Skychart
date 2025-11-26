const express = require('express');
const auth = require('../middleware/auth');
const router = express.Router();
const pool = require('../config/database');
const upload = require('../middleware/upload');

// Хэндлер создания, используется для POST / и POST /create
const createSkychartHandler = async (req, res) => {
    const client = await pool.connect();

    try {
        const userId = req.user.id;
        const { title } = req.body;
        const isPublic = req.body.is_public === 'true' || req.body.is_public === true;
        
        // Исправьте путь к изображению
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

        // Получаем точки обратно
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
        
        // Удаляем загруженный файл если произошла ошибка
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

// Создать новый skychart (поддерживает multipart/form-data с изображением)
router.post('/', auth, upload.single('image'), createSkychartHandler);
router.post('/create', auth, upload.single('image'), createSkychartHandler);

/**
 * Получить список всех публичных skycharts
 * GET /api/skycharts/public
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
 * Получить свои skycharts
 * GET /api/skycharts/my
 */
router.get('/my', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            `SELECT
                id,
                title,
                user_id,
                is_public,
                image_url,
                created_at,
                updated_at
             FROM skycharts
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [userId]
        );

        res.json({ skycharts: result.rows });
    } catch (error) {
        console.error('Get my skycharts error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Получить конкретный skychart + точки
 * GET /api/skycharts/:id
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
 * Удалить свой skychart
 * DELETE /api/skycharts/:id
 */
router.delete('/:id', auth, async (req, res) => {
    try {
        const chartId = req.params.id;
        const userId = req.user.id;

        // Проверяем, что чарт принадлежит пользователю
        const chartResult = await pool.query(
            `SELECT id, user_id
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

        // Удаляем чарт (точки удалятся по ON DELETE CASCADE)
        await pool.query(
            `DELETE FROM skycharts
             WHERE id = $1`,
            [chartId]
        );

        res.json({ message: 'Skychart deleted successfully' });
    } catch (error) {
        console.error('Delete skychart error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
