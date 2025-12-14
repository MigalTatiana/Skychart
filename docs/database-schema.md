# Database Schemе Documentation

## Tables

### users
- `id` (SERIAL PRIMARY KEY)
- `email` (VARCHAR UNIQUE NOT NULL)
- `password_hash` (VARCHAR NOT NULL) 
- `username` (VARCHAR)
- `created_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)

### skycharts
- `id` (SERIAL PRIMARY KEY)
- `title` (VARCHAR NOT NULL)
- `user_id` (INTEGER REFERENCES users(id))
- `is_public` (BOOLEAN DEFAULT FALSE)
- `image_url` (VARCHAR)
- `created_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)

### skychart_ponts
- `id` (SERIAL PRIMARY KEY)
- `skychart_id` (INTEGER REFERENCES skycharts(id) ON DELETE CASCADE)
- `x` (DECIMAL NOT NULL)
- `y` (DECIMAL NOT NULL)
- `radius` (DECIMAL NOT NULL)
- `name` (VARCHAR NOT NULL)

### chats
- `id` (SERIAL PRIMARY KEY)
- `user1_id` (INTEGER REFERENCES users(id))
- `user2_id` (INTEGER REFERENCES users(id))
- `created_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- UNIQUE(user1_id, user2_id)

### favorite_chats
- `id` (SERIAL PRIMARY KEY)
- `user_id` (INTEGER REFERENCES users(id) UNIQUE)
- `created_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)

### messages
- `id` (SERIAL PRIMARY KEY)
- `chat_id` (INTEGER REFERENCES chats(id))
- `favorite_chat_id` (INTEGER REFERENCES favorite_chats(id))
- `sender_id` (INTEGER REFERENCES users(id))
- `content` (TEXT NOT NULL)
- `created_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- `is_read` (BOOLEAN DEFAULT FALSE)

## Диаграмма отношений
