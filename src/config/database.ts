import { Pool } from "pg";
import dotenv from "dotenv";

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
  connectionString: process.env.DATABASE_URL,
  // SSL configuration - only enable for cloud databases (like Neon)
  // For local PostgreSQL, set DB_SSL=false or leave it unset
  // Automatically enable SSL in production or on Vercel
  ssl:
    process.env.DB_SSL === "true" ||
    process.env.NODE_ENV === "production" ||
    !!process.env.VERCEL
      ? {
          rejectUnauthorized: false,
        }
      : false,

  // Maximum number of clients in the pool
  // In serverless environments (Vercel), we should keep this low (1-2)
  // because each lambda invocation creates a new pool.
  max: process.env.NODE_ENV === "production" || !!process.env.VERCEL ? 1 : 20,

  // How long a client can be idle before being closed (in milliseconds)
  // 30 seconds is a good balance
  idleTimeoutMillis: 30000,

  // How long to wait for a connection before timing out (in milliseconds)
  // Increased to 10s to handle cold starts or network latency
  connectionTimeoutMillis: 10000,
});

// Event listener for successful connections
pool.on("connect", () => {
  console.log("✅ Connected to PostgreSQL database");
});

// Event listener for errors
pool.on("error", (err) => {
  console.error("❌ Unexpected error on idle PostgreSQL client:", err);
});

/**
 * Helper function to test database connection
 */
export const testConnection = async (): Promise<boolean> => {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log(
      "✅ Database connection test successful at:",
      result.rows[0].now,
    );
    return true;
  } catch (error) {
    console.error("❌ Database connection test failed:", error);
    return false;
  }
};

export default pool;
