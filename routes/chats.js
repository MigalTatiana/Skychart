const express = require('express');
const auth = require('../middleware/auth');
const router = express.Router();
const pool = require('../config/database');

/**
 * Получить список чатов пользователя
 * GET /api/chats
 */
router.get('/', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        // Получаем обычные чаты с другими пользователями
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

        // Получаем или создаем избранный чат
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

        // Получаем последнее сообщение из избранного
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

        // Форматируем обычные чаты
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
 * Создать или получить чат с пользователем
 * POST /api/chats
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

        // Проверяем существование целевого пользователя
        const targetUser = await pool.query(
            'SELECT id, username, email FROM users WHERE id = $1',
            [target_user_id]
        );

        if (targetUser.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Ищем существующий чат
        const existingChat = await pool.query(
            `SELECT id, user1_id, user2_id, created_at 
             FROM chats 
             WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)`,
            [userId, target_user_id]
        );

        if (existingChat.rows.length > 0) {
            const chat = existingChat.rows[0];
            const otherUser = chat.user1_id === userId ? 
                targetUser.rows[0] : 
                await pool.query('SELECT id, username, email FROM users WHERE id = $1', [chat.user1_id]);

            return res.json({
                chat: {
                    id: chat.id,
                    type: 'user',
                    other_user: otherUser.rows[0],
                    created_at: chat.created_at
                },
                created: false
            });
        }

        // Создаем новый чат
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
 * Получить сообщения чата
 * GET /api/chats/:id/messages
 */
router.get('/:id/messages', auth, async (req, res) => {
    try {
        const chatId = req.params.id;
        const userId = req.user.id;

        // Определяем тип чата
        if (chatId.startsWith('favorite_')) {
            const favoriteChatId = chatId.replace('favorite_', '');
            
            // Проверяем доступ к избранному
            const favoriteChat = await pool.query(
                'SELECT user_id FROM favorite_chats WHERE id = $1',
                [favoriteChatId]
            );

            if (favoriteChat.rows.length === 0 || favoriteChat.rows[0].user_id !== userId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // Получаем сообщения из избранного
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
            // Обычный чат
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

            // Получаем сообщения обычного чата
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

            // Помечаем сообщения как прочитанные
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
 * Отправить сообщение
 * POST /api/chats/:id/messages
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
            
            // Проверяем доступ к избранному
            const favoriteChat = await pool.query(
                'SELECT user_id FROM favorite_chats WHERE id = $1',
                [favoriteChatId]
            );

            if (favoriteChat.rows.length === 0 || favoriteChat.rows[0].user_id !== userId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // Сохраняем сообщение в избранное
            message = await pool.query(
                `INSERT INTO messages (favorite_chat_id, sender_id, content) 
                 VALUES ($1, $2, $3) 
                 RETURNING id, sender_id, content, created_at, is_read`,
                [favoriteChatId, userId, content.trim()]
            );

        } else {
            // Обычный чат
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

            // Сохраняем сообщение в обычный чат
            message = await pool.query(
                `INSERT INTO messages (chat_id, sender_id, content) 
                 VALUES ($1, $2, $3) 
                 RETURNING id, sender_id, content, created_at, is_read`,
                [chatId, userId, content.trim()]
            );
        }

        // Получаем данные отправителя
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
 * Поиск пользователей для создания чата
 * GET /api/chats/users/search?q=username
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