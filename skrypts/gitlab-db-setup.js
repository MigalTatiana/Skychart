const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'skychart_test',
  user: process.env.POSTGRES_USER || 'gitlab',
  password: process.env.POSTGRES_PASSWORD || 'password',
});

async function setupGitLabDatabase() {
  try {
    await pool.query('SELECT 1');
    console.log('GitLab CI database connection established');
  } catch (error) {
    console.error('GitLab database setup failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

module.exports = setupGitLabDatabase;