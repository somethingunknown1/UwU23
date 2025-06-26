// Run this file ONCE to create your tables

const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL, // Set this in your Railway dashboard
  ssl: { rejectUnauthorized: false }
});

async function createTables() {
  await client.connect();

  // Users table
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(64) UNIQUE NOT NULL,
      username VARCHAR(100) NOT NULL,
      notes TEXT[],
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Applications table
  await client.query(`
    CREATE TABLE IF NOT EXISTS applications (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(64) REFERENCES users(user_id),
      status VARCHAR(32),
      reason TEXT,
      date TIMESTAMP DEFAULT NOW()
    );
  `);

  // Ban logs table
  await client.query(`
    CREATE TABLE IF NOT EXISTS ban_logs (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(64) REFERENCES users(user_id),
      admin VARCHAR(100),
      action VARCHAR(100),
      changes JSONB,
      timestamp TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log('Tables created!');
  await client.end();
}

createTables().catch(console.error);