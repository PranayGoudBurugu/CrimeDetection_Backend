import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * PostgreSQL Connection Pool
 * 
 * A pool maintains multiple database connections that can be reused,
 * which is much more efficient than creating a new connection for each query.
 * 
 * Think of it like a "pool" of workers - instead of hiring and firing workers
 * for each task, you keep a pool of workers ready to pick up tasks as needed.
 */
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'nithya_analysis',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,

    // Maximum number of clients in the pool
    // Don't set this too high or you'll run out of database connections
    max: 20,

    // How long a client can be idle before being closed (in milliseconds)
    // 30 seconds is a good balance
    idleTimeoutMillis: 30000,

    // How long to wait for a connection before timing out (in milliseconds)
    connectionTimeoutMillis: 2000,
});

// Event listener for successful connections
pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
});

// Event listener for errors
pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle PostgreSQL client:', err);
});

/**
 * Helper function to test database connection
 */
export const testConnection = async (): Promise<boolean> => {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('✅ Database connection test successful at:', result.rows[0].now);
        return true;
    } catch (error) {
        console.error('❌ Database connection test failed:', error);
        return false;
    }
};

export default pool;
