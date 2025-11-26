CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_users_email ON users(email);

CREATE TABLE skychart_points (
    id SERIAL PRIMARY KEY,
    skychart_id INTEGER REFERENCES skycharts(id) ON DELETE CASCADE,
    x DECIMAL(10, 6) NOT NULL CHECK (x >= 0 AND x <= 1),
    y DECIMAL(10, 6) NOT NULL CHECK (y >= 0 AND y <= 1),
    radius DECIMAL(10, 6) NOT NULL CHECK (radius > 0 AND radius <= 0.2),
    name VARCHAR(100) NOT NULL
);

CREATE TABLE skycharts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT FALSE,
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
