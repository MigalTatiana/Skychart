const express = require('express');
const auth = require('../middleware/auth');
const router = express.Router();
const pool = require('../config/database');

/**
 * @swagger
 * tags:
 *   name: Chats
 *   description: Управление чатами и сообщениями
 */

/**
 * @swagger
 * /api/chats:
 *   get:
 *     summary: Получить список чатов пользователя
 *     description: Возвращает все чаты пользователя, включая избранный чат и чаты с другими пользователями
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Успешный запрос списка чатов
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 chats:
 *                   type: array
 *                   description: Список чатов с другими пользователями
 *                   items:
 *                     $ref: '#/components/schemas/Chat'
 *                 favorite_chat:
 *                   $ref: '#/components/schemas/Chat'
 *                   description: Избранный чат пользователя
 *       401:
 *         description: Неавторизованный доступ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Внутренняя ошибка сервера
 */
router.get('/', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const chatsResult = await pool.query(
            `SELECT 
                c.id,
                c.user1_id,
                c.user2_id,
                c.created_at,
                u1.username as user1_username,
                u1.email as user1_email,
                u2.username as user2_username,
                u2.email as user2_email,
                (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
                (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time
             FROM chats c
             JOIN users u1 ON c.user1_id = u1.id
             JOIN users u2 ON c.user2_id = u2.id
             WHERE c.user1_id = $1 OR c.user2_id = $1
             ORDER BY last_message_time DESC NULLS LAST`,
            [userId]
        );

        let favoriteChat = await pool.query(
            `SELECT id, user_id, created_at 
             FROM favorite_chats 
             WHERE user_id = $1`,
            [userId]
        );

        if (favoriteChat.rows.length === 0) {
            favoriteChat = await pool.query(
                `INSERT INTO favorite_chats (user_id) 
                 VALUES ($1) 
                 RETURNING id, user_id, created_at`,
                [userId]
            );
        }

        const favoriteLastMessage = await pool.query(
            `SELECT content, created_at 
             FROM messages 
             WHERE favorite_chat_id = $1 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [favoriteChat.rows[0].id]
        );

        const favoriteChatData = {
            id: 'favorite_' + favoriteChat.rows[0].id,
            type: 'favorite',
            user_id: userId,
            created_at: favoriteChat.rows[0].created_at,
            last_message: favoriteLastMessage.rows[0]?.content,
            last_message_time: favoriteLastMessage.rows[0]?.created_at
        };

        const formattedChats = chatsResult.rows.map(chat => {
            const otherUser = chat.user1_id === userId ? 
                { id: chat.user2_id, username: chat.user2_username, email: chat.user2_email } :
                { id: chat.user1_id, username: chat.user1_username, email: chat.user1_email };
            
            return {
                id: chat.id,
                type: 'user',
                other_user: otherUser,
                created_at: chat.created_at,
                last_message: chat.last_message,
                last_message_time: chat.last_message_time
            };
        });

        res.json({
            chats: formattedChats,
            favorite_chat: favoriteChatData
        });

    } catch (error) {
        console.error('Get chats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/chats:
 *   post:
 *     summary: Создать новый чат с пользователем
 *     description: Создает чат между текущим пользователем и указанным пользователем. Если чат уже существует, возвращает существующий чат.
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - target_user_id
 *             properties:
 *               target_user_id:
 *                 type: integer
 *                 description: ID пользователя, с которым создается чат
 *                 example: 2
 *     responses:
 *       201:
 *         description: Чат успешно создан
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 chat:
 *                   $ref: '#/components/schemas/Chat'
 *                 created:
 *                   type: boolean
 *                   description: Флаг создания нового чата
 *                   example: true
 *       200:
 *         description: Чат уже существует
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 chat:
 *                   $ref: '#/components/schemas/Chat'
 *                 created:
 *                   type: boolean
 *                   example: false
 *       400:
 *         description: Неверные параметры запроса
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Попытка создать чат с самим собой
 *       404:
 *         description: Пользователь не найден
 *       500:
 *         description: Внутренняя ошибка сервера
 */
router.post('/', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { target_user_id } = req.body;

        if (!target_user_id) {
            return res.status(400).json({ error: 'Target user ID is required' });
        }

        if (target_user_id == userId) {
            return res.status(400).json({ error: 'Cannot create chat with yourself' });
        }

        const targetUser = await pool.query(
            'SELECT id, username, email FROM users WHERE id = $1',
            [target_user_id]
        );

        if (targetUser.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const existingChat = await pool.query(
            `SELECT id, user1_id, user2_id, created_at 
             FROM chats 
             WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)`,
            [userId, target_user_id]
        );

        if (existingChat.rows.length > 0) {
            const chat = existingChat.rows[0];
            let otherUser;
            if (chat.user1_id === userId) {
                otherUser = targetUser.rows[0];
            } else {
                const user1Result = await pool.query(
                    'SELECT id, username, email FROM users WHERE id = $1',
                    [chat.user1_id]
                );
                otherUser = user1Result.rows[0];
            }
            if (!otherUser) {
                return res.status(404).json({ error: 'Other user not found' });
            }

            return res.json({
                chat: {
                    id: chat.id,
                    type: 'user',
                    other_user: otherUser,
                    created_at: chat.created_at
                },
                created: false
            });
        }
        const newChat = await pool.query(
            `INSERT INTO chats (user1_id, user2_id) 
             VALUES ($1, $2) 
             RETURNING id, user1_id, user2_id, created_at`,
            [userId, target_user_id]
        );

        res.status(201).json({
            chat: {
                id: newChat.rows[0].id,
                type: 'user',
                other_user: targetUser.rows[0],
                created_at: newChat.rows[0].created_at
            },
            created: true
        });

    } catch (error) {
        console.error('Create chat error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * @swagger
 * /api/chats/{id}/messages:
 *   get:
 *     summary: Получить сообщения чата
 *     description: Возвращает все сообщения указанного чата. Поддерживает как обычные чаты, так и избранные чаты.
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: |
 *           ID чата. Для избранного чата используйте префикс 'favorite_'
 *           Пример: 'favorite_1' или '123'
 *     responses:
 *       200:
 *         description: Успешный запрос сообщений
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   description: Список сообщений чата
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *                 chat_type:
 *                   type: string
 *                   enum: [user, favorite]
 *                   description: Тип чата
 *       403:
 *         description: Нет доступа к чату
 *       404:
 *         description: Чат не найден
 *       500:
 *         description: Внутренняя ошибка сервера
 */
router.get('/:id/messages', auth, async (req, res) => {
    try {
        const chatId = req.params.id;
        const userId = req.user.id;
        if (chatId.startsWith('favorite_')) {
            const favoriteChatId = chatId.replace('favorite_', '');
            const favoriteChat = await pool.query(
                'SELECT user_id FROM favorite_chats WHERE id = $1',
                [favoriteChatId]
            );

            if (favoriteChat.rows.length === 0 || favoriteChat.rows[0].user_id !== userId) {
                return res.status(403).json({ error: 'Access denied' });
            }
            const messages = await pool.query(
                `SELECT 
                    m.id,
                    m.sender_id,
                    m.content,
                    m.created_at,
                    m.is_read,
                    u.username as sender_username
                 FROM messages m
                 JOIN users u ON m.sender_id = u.id
                 WHERE m.favorite_chat_id = $1
                 ORDER BY m.created_at ASC`,
                [favoriteChatId]
            );

            return res.json({ messages: messages.rows, chat_type: 'favorite' });

        } else {
            const chat = await pool.query(
                'SELECT user1_id, user2_id FROM chats WHERE id = $1',
                [chatId]
            );

            if (chat.rows.length === 0) {
                return res.status(404).json({ error: 'Chat not found' });
            }

            const chatData = chat.rows[0];
            if (chatData.user1_id !== userId && chatData.user2_id !== userId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const messages = await pool.query(
                `SELECT 
                    m.id,
                    m.sender_id,
                    m.content,
                    m.created_at,
                    m.is_read,
                    u.username as sender_username
                 FROM messages m
                 JOIN users u ON m.sender_id = u.id
                 WHERE m.chat_id = $1
                 ORDER BY m.created_at ASC`,
                [chatId]
            );

            await pool.query(
                `UPDATE messages 
                 SET is_read = TRUE 
                 WHERE chat_id = $1 AND sender_id != $2 AND is_read = FALSE`,
                [chatId, userId]
            );

            return res.json({ messages: messages.rows, chat_type: 'user' });
        }

    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/chats/{id}/messages:
 *   post:
 *     summary: Отправить сообщение в чат
 *     description: Отправляет текстовое сообщение в указанный чат. Поддерживает обычные чаты и избранные чаты.
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: |
 *           ID чата. Для избранного чата используйте префикс 'favorite_'
 *           Пример: 'favorite_1' или '123'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Текст сообщения
 *                 example: Привет! Как дела?
 *                 minLength: 1
 *                 maxLength: 1000
 *     responses:
 *       201:
 *         description: Сообщение успешно отправлено
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   $ref: '#/components/schemas/Message'
 *       400:
 *         description: Неверные параметры сообщения
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Нет доступа к чату
 *       404:
 *         description: Чат не найден
 *       500:
 *         description: Внутренняя ошибка сервера
 */
router.post('/:id/messages', auth, async (req, res) => {
    try {
        const chatId = req.params.id;
        const userId = req.user.id;
        const { content } = req.body;

        if (!content || content.trim() === '') {
            return res.status(400).json({ error: 'Message content is required' });
        }

        let message;

        if (chatId.startsWith('favorite_')) {
            const favoriteChatId = chatId.replace('favorite_', '');
            
            const favoriteChat = await pool.query(
                'SELECT user_id FROM favorite_chats WHERE id = $1',
                [favoriteChatId]
            );

            if (favoriteChat.rows.length === 0 || favoriteChat.rows[0].user_id !== userId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            message = await pool.query(
                `INSERT INTO messages (favorite_chat_id, sender_id, content) 
                 VALUES ($1, $2, $3) 
                 RETURNING id, sender_id, content, created_at, is_read`,
                [favoriteChatId, userId, content.trim()]
            );

        } else {
            const chat = await pool.query(
                'SELECT user1_id, user2_id FROM chats WHERE id = $1',
                [chatId]
            );

            if (chat.rows.length === 0) {
                return res.status(404).json({ error: 'Chat not found' });
            }

            const chatData = chat.rows[0];
            if (chatData.user1_id !== userId && chatData.user2_id !== userId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            message = await pool.query(
                `INSERT INTO messages (chat_id, sender_id, content) 
                 VALUES ($1, $2, $3) 
                 RETURNING id, sender_id, content, created_at, is_read`,
                [chatId, userId, content.trim()]
            );
        }

        const sender = await pool.query(
            'SELECT username FROM users WHERE id = $1',
            [userId]
        );

        res.status(201).json({
            message: {
                ...message.rows[0],
                sender_username: sender.rows[0].username
            }
        });

    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/chats/users/search:
 *   get:
 *     summary: Поиск пользователей для создания чата
 *     description: Поиск пользователей по username или email для создания нового чата
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Поисковый запрос (минимум 2 символа)
 *         example: john
 *     responses:
 *       200:
 *         description: Успешный поиск пользователей
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   description: Список найденных пользователей
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       400:
 *         description: Слишком короткий поисковый запрос
 *       500:
 *         description: Внутренняя ошибка сервера
 */
router.get('/users/search', auth, async (req, res) => {
    try {
        const { q } = req.query;
        const userId = req.user.id;

        if (!q || q.length < 2) {
            return res.json({ users: [] });
        }

        const users = await pool.query(
            `SELECT id, username, email 
             FROM users 
             WHERE (username ILIKE $1 OR email ILIKE $1) AND id != $2
             LIMIT 10`,
            [`%${q}%`, userId]
        );

        res.json({ users: users.rows });

    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;