import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool, { testConnection } from "./config/database";
import analysisRoutes from "./routes/analysisRoutes";
import settingsRoutes from "./routes/settingsRoutes";
import {
  handleMulterError,
  handleError,
  handle404,
} from "./middleware/errorHandler";
// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 5005;

// Handle BigInt serialization for JSON
// @ts-ignore
BigInt.prototype.toJSON = function () {
  return this.toString();
};

// ============================================
// MIDDLEWARE
// ============================================

// Enable CORS for frontend requests
// Enable CORS for frontend requests
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
      ];
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
        callback(null, true);
      } else {
        console.log("Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

// Parse JSON request bodies
app.use(express.json());

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory (for video access)
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static("uploads"),
);

// Request logging middleware (simple version)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================
// DATABASE CONNECTION TEST & INITIALIZATION
// ============================================
import { initializeDatabase } from "./scripts/initDb";

// Track database initialization status
let dbInitPromise: Promise<void> | null = null;
let dbInitialized = false;

// Initialize database on startup
const initDb = async () => {
  try {
    const success = await testConnection();
    if (success) {
      console.log("✅ Database is ready");
      await initializeDatabase();
      dbInitialized = true;
      console.log("✅ Database initialization complete");
    } else {
      console.error(
        "❌ Database connection failed. Please check your .env configuration.",
      );
      throw new Error("Database connection failed");
    }
  } catch (error) {
    console.error("❌ Database initialization error:", error);
    throw error;
  }
};

// Start initialization immediately
// dbInitPromise = initDb();

// ============================================
// ROUTES
// ============================================

// Health check endpoint
app.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Nrithya Analysis API is running",
    version: "1.0.0",
    endpoints: {
      analysis: "POST /getanalysis - Upload video for analysis",
      history: "GET /history - Get analysis history",
      getById: "GET /analysis/:id - Get specific analysis",
      delete: "DELETE /analysis/:id - Delete analysis",
    },
  });
});

// Health check for database
app.get("/health", async (req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      success: true,
      database: "connected",
      timestamp: result.rows[0].now,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Analysis routes (all video analysis endpoints)
app.use("/", analysisRoutes);

// Settings routes (application settings management)
app.use("/", settingsRoutes);

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

// Handle multer errors
app.use(handleMulterError);

// Handle 404 errors
app.use(handle404);

// General error handler (must be last)
app.use(handleError);

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log("");
  console.log("═══════════════════════════════════════════");
  console.log("🚀 Nrithya Analysis Backend Server Started");
  console.log(`📍 Server:    http://localhost:${PORT}`);
  console.log("═══════════════════════════════════════════");
  console.log("");
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing server");
  pool.end(() => {
    console.log("Database pool closed");
    process.exit(0);
  });
});
