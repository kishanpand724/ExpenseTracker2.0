import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import session from "express-session";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

const currentDir = typeof __dirname !== "undefined"
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from backend/.env or root .env
dotenv.config({ path: path.join(currentDir, ".env") });
dotenv.config();

// Helper password functions matching Java PasswordUtils (PBKDF2WithHmacSHA256) & bcrypt
function hashPasswordPbkdf2(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 32, "sha256");
  return salt.toString("base64") + ":" + hash.toString("base64");
}

function verifyPasswordHash(password: string, storedHash: string, userEmail?: string): boolean {
  if (!password || !storedHash) return false;

  // 1. Check PBKDF2 (saltBase64:hashBase64) format from Java PasswordUtils
  if (storedHash.includes(":")) {
    try {
      const parts = storedHash.split(":");
      const salt = Buffer.from(parts[0], "base64");
      const expectedHash = Buffer.from(parts[1], "base64");
      const actualHash = crypto.pbkdf2Sync(password, salt, 10000, expectedHash.length, "sha256");
      if (crypto.timingSafeEqual(expectedHash, actualHash)) return true;
    } catch (e) {}
  }

  // 2. Check Bcrypt format
  if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$")) {
    try {
      if (bcrypt.compareSync(password, storedHash)) return true;
    } catch (e) {}
  }

  // 3. Fallback demo account check
  if (userEmail && "demo@expensetracker.com".toLowerCase() === userEmail.toLowerCase() && "password123" === password) {
    return true;
  }

  // 4. Plain text match fallback
  if (password === storedHash) return true;

  return false;
}

const app = express();
const PORT = 3000;

// Reverse proxy support for production deployment (Render, Cloud Run, etc.)
app.set("trust proxy", 1);

// CORS configuration for cross-origin deployment (e.g. Vercel frontend calling Render backend)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept");
  }
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Body parser & Cookie / Session middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

const isProd = process.env.NODE_ENV === "production";
const isCrossOrigin = process.env.CROSS_ORIGIN === "true" || !!process.env.FRONTEND_URL;

app.use(
  session({
    name: "JSESSIONID",
    secret: process.env.SESSION_SECRET || "expense_tracker_secure_session_secret_2026",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProd && isCrossOrigin,
      httpOnly: true,
      sameSite: isCrossOrigin ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);

declare module "express-session" {
  interface SessionData {
    userId?: number;
    user_id?: number;
    userName?: string;
    user_name?: string;
    userEmail?: string;
    user_email?: string;
  }
}

// Initialize PGlite (Embedded PostgreSQL Engine)
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const dbPath = path.join(DATA_DIR, "pgdata");
const db = new PGlite(dbPath);

const DB_CONFIG_FILE = path.join(DATA_DIR, "db_config.json");

// Optional Remote PostgreSQL Pool if external DATABASE_URL or SUPABASE_* parameters provided
let externalPgPool: Pool | null = null;
let currentDbUrl = process.env.DATABASE_URL || "";

if (!currentDbUrl && process.env.SUPABASE_HOST && process.env.SUPABASE_PASSWORD) {
  const user = encodeURIComponent(process.env.SUPABASE_USER || "postgres");
  const pass = encodeURIComponent(process.env.SUPABASE_PASSWORD);
  const host = process.env.SUPABASE_HOST;
  const port = process.env.SUPABASE_PORT || "5432";
  const dbName = process.env.SUPABASE_DB || "postgres";
  currentDbUrl = `postgresql://${user}:${pass}@${host}:${port}/${dbName}?sslmode=require`;
}

function initExternalPgPool(url: string) {
  if (!url || url.trim() === "") return null;
  try {
    const isSslNeeded = !url.includes("localhost") && !url.includes("127.0.0.1");
    const cleanUrl = url.replace(/[\?&]sslmode=[^&]+/g, "");
    const pool = new Pool({
      connectionString: cleanUrl,
      ssl: isSslNeeded ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000
    });
    return pool;
  } catch (e: any) {
    console.error("Failed to parse external PG URL:", e.message);
    return null;
  }
}

// Load saved connection string from db_config.json if exists
if (fs.existsSync(DB_CONFIG_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(DB_CONFIG_FILE, "utf-8"));
    if (saved.db_url) {
      currentDbUrl = saved.db_url;
    }
  } catch (e) {}
}

if (currentDbUrl) {
  externalPgPool = initExternalPgPool(currentDbUrl);
}

// Function to initialize PostgreSQL tables, users & seeds
async function initDatabase() {
  console.log("Initializing PostgreSQL database...");
  const createUsersTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createTransactionsQuery = `
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      type VARCHAR(20) NOT NULL,
      category VARCHAR(50) NOT NULL,
      amount NUMERIC(12, 2) NOT NULL,
      title VARCHAR(255) NOT NULL,
      transaction_date DATE NOT NULL,
      user_id INTEGER
    );
  `;

  const createSubscriptionsQuery = `
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(50) NOT NULL,
      amount NUMERIC(12, 2) NOT NULL,
      billing_cycle VARCHAR(50) NOT NULL DEFAULT 'Monthly',
      next_billing DATE NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Active',
      user_id INTEGER
    );
  `;

  await db.query(createUsersTableQuery);
  await db.query(createTransactionsQuery);
  await db.query(createSubscriptionsQuery);
  await db.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id INTEGER;");
  await db.query("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS user_id INTEGER;");

  if (externalPgPool) {
    try {
      await externalPgPool.query(createUsersTableQuery);
      await externalPgPool.query(createTransactionsQuery);
      await externalPgPool.query(createSubscriptionsQuery);
      await externalPgPool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id INTEGER;");
      await externalPgPool.query("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS user_id INTEGER;");
      console.log("Connected to External PostgreSQL pool successfully!");
    } catch (e: any) {
      console.error("External PG connection error:", e.message);
    }
  }

  // Ensure default demo user exists
  const defaultEmail = "demo@expensetracker.com";
  const defaultPassHash = bcrypt.hashSync("password123", 10);
  let defaultUserId = 1;

  try {
    const userCheck = await db.query<{ id: number }>("SELECT id FROM users WHERE LOWER(email) = LOWER($1);", [defaultEmail]);
    if (userCheck.rows.length === 0) {
      const insUser = await db.query<{ id: number }>(
        "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id;",
        ["Demo User", defaultEmail, defaultPassHash]
      );
      defaultUserId = insUser.rows[0]?.id || 1;
    } else {
      defaultUserId = userCheck.rows[0].id;
    }

    if (externalPgPool) {
      try {
        const extUserCheck = await externalPgPool.query<{ id: number }>("SELECT id FROM users WHERE LOWER(email) = LOWER($1);", [defaultEmail]);
        if (extUserCheck.rows.length === 0) {
          await externalPgPool.query(
            "INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING;",
            [defaultUserId, "Demo User", defaultEmail, defaultPassHash]
          );
        }
      } catch (e: any) {
        console.error("External PG demo user setup error:", e.message);
      }
    }
  } catch (err: any) {
    console.error("Demo user initialization error:", err.message);
  }

  // Update existing unassigned transactions and subscriptions to defaultUserId
  await db.query("UPDATE transactions SET user_id = $1 WHERE user_id IS NULL;", [defaultUserId]);
  await db.query("UPDATE subscriptions SET user_id = $1 WHERE user_id IS NULL;", [defaultUserId]);
  if (externalPgPool) {
    try {
      await externalPgPool.query("UPDATE transactions SET user_id = $1 WHERE user_id IS NULL;", [defaultUserId]);
      await externalPgPool.query("UPDATE subscriptions SET user_id = $1 WHERE user_id IS NULL;", [defaultUserId]);
    } catch (e) {}
  }

  // Seed initial transactions if table is completely empty
  const countRes = await db.query<{ count: string }>("SELECT COUNT(*) as count FROM transactions;");
  if (parseInt(countRes.rows[0]?.count || "0", 10) === 0 && !externalPgPool) {
    console.log("Seeding initial transactions into PostgreSQL database...");
    const seeds = [
      ["expense", "food", 1200, "Dinner with friends", "2026-09-17", defaultUserId],
      ["income", "salary", 50000, "Monthly Salary", "2026-09-16", defaultUserId],
      ["expense", "bills", 2500, "Electricity Bill", "2026-09-15", defaultUserId],
      ["expense", "shopping", 4800, "New Headphones", "2026-09-14", defaultUserId],
      ["expense", "travel", 850, "Cab Fare to Office", "2026-09-13", defaultUserId]
    ];

    for (const seed of seeds) {
      await db.query(
        "INSERT INTO transactions (type, category, amount, title, transaction_date, user_id) VALUES ($1, $2, $3, $4, $5, $6);",
        seed
      );
    }
  }

  console.log("PostgreSQL database setup complete!");
}

initDatabase().catch(err => console.error("Database initialization error:", err));

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

app.post(["/signup", "/SignupServlet", "/api/auth/signup"], async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;

  if (!name || !email || !password || !confirmPassword) {
    return res.status(400).json({ error: "All fields are required." });
  }

  const cleanName = String(name).trim();
  const cleanEmail = String(email).trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long." });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Password and Confirm Password do not match." });
  }

  try {
    const checkSql = "SELECT id FROM users WHERE LOWER(email) = $1;";
    const existing = await db.query<{ id: number }>(checkSql, [cleanEmail]);

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "An account with this email address already exists. Please log in." });
    }

    if (externalPgPool) {
      try {
        const extExisting = await externalPgPool.query<{ id: number }>(checkSql, [cleanEmail]);
        if (extExisting.rows.length > 0) {
          return res.status(400).json({ error: "An account with this email address already exists. Please log in." });
        }
      } catch (e: any) {}
    }

    const passwordHash = hashPasswordPbkdf2(password);
    const insertSql = "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id;";

    let newUserId: number;

    if (externalPgPool) {
      try {
        const extRes = await externalPgPool.query<{ id: number }>(insertSql, [cleanName, cleanEmail, passwordHash]);
        newUserId = extRes.rows[0]?.id || Date.now();
        await db.query(
          "INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING;",
          [newUserId, cleanName, cleanEmail, passwordHash]
        );
      } catch (extErr: any) {
        const localRes = await db.query<{ id: number }>(insertSql, [cleanName, cleanEmail, passwordHash]);
        newUserId = localRes.rows[0]?.id || Date.now();
      }
    } else {
      const localRes = await db.query<{ id: number }>(insertSql, [cleanName, cleanEmail, passwordHash]);
      newUserId = localRes.rows[0]?.id || Date.now();
    }

    req.session.userId = newUserId;
    req.session.user_id = newUserId;
    req.session.userName = cleanName;
    req.session.user_name = cleanName;
    req.session.userEmail = cleanEmail;
    req.session.user_email = cleanEmail;

    req.session.save((saveErr) => {
      if (saveErr) console.error("Session save error on signup:", saveErr);
      return res.json({
        success: true,
        message: "Account registered successfully",
        redirect: "index.html",
        user_id: newUserId,
        user: { id: newUserId, name: cleanName, email: cleanEmail }
      });
    });
  } catch (err: any) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Account creation failed: " + err.message });
  }
});

app.get(["/login", "/LoginServlet"], (req, res) => {
  const uid = req.session?.userId || req.session?.user_id;
  if (uid) {
    return res.redirect(302, "index.html");
  }
  return res.redirect(302, "login.html");
});

app.get(["/signup", "/SignupServlet"], (req, res) => {
  const uid = req.session?.userId || req.session?.user_id;
  if (uid) {
    return res.redirect(302, "index.html");
  }
  return res.redirect(302, "signup.html");
});

app.post(["/login", "/LoginServlet", "/api/auth/login"], async (req, res) => {
  const { email, password } = req.body;
  const isAjax = req.xhr || req.headers.accept?.includes("json") || req.is("json");

  if (!email || !password) {
    if (!isAjax) {
      return res.redirect(302, "login.html?error=" + encodeURIComponent("Email and password are required."));
    }
    return res.status(400).json({ error: "Email and password are required." });
  }

  const cleanEmail = String(email).trim().toLowerCase();

  try {
    const selectSql = "SELECT id, name, email, password_hash FROM users WHERE LOWER(email) = $1;";
    let userRow: any = null;

    if (externalPgPool) {
      try {
        const extRes = await externalPgPool.query(selectSql, [cleanEmail]);
        if (extRes.rows.length > 0) userRow = extRes.rows[0];
      } catch (e: any) {}
    }

    if (!userRow) {
      const localRes = await db.query(selectSql, [cleanEmail]);
      if (localRes.rows.length > 0) userRow = localRes.rows[0];
    }

    if (!userRow) {
      if (!isAjax) {
        return res.redirect(302, "login.html?error=" + encodeURIComponent("Invalid email or password."));
      }
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const isMatch = verifyPasswordHash(password, userRow.password_hash, userRow.email);
    if (!isMatch) {
      if (!isAjax) {
        return res.redirect(302, "login.html?error=" + encodeURIComponent("Invalid email or password."));
      }
      return res.status(401).json({ error: "Invalid email or password." });
    }

    req.session.userId = userRow.id;
    req.session.user_id = userRow.id;
    req.session.userName = userRow.name;
    req.session.user_name = userRow.name;
    req.session.userEmail = userRow.email;
    req.session.user_email = userRow.email;

    req.session.save((saveErr) => {
      if (saveErr) console.error("Session save error on login:", saveErr);
      if (!isAjax) {
        return res.redirect(302, "index.html");
      }
      return res.json({
        success: true,
        message: "Login successful",
        redirect: "index.html",
        user_id: userRow.id,
        user: { id: userRow.id, name: userRow.name, email: userRow.email }
      });
    });
  } catch (err: any) {
    console.error("Login error:", err);
    if (!isAjax) {
      return res.redirect(302, "login.html?error=" + encodeURIComponent("Login failed: " + err.message));
    }
    return res.status(500).json({ error: "Login failed: " + err.message });
  }
});

const handleSessionCheck = (req: express.Request, res: express.Response) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  const uid = req.session?.userId || req.session?.user_id;
  if (req.session && uid) {
    return res.json({
      authenticated: true,
      user_id: uid,
      user: {
        id: uid,
        name: req.session.userName || req.session.user_name || "User",
        email: req.session.userEmail || req.session.user_email || ""
      }
    });
  }
  return res.json({ authenticated: false });
};

app.get(["/session-check", "/SessionCheckServlet", "/api/auth/me", "/AuthCheckServlet", "/auth-check"], handleSessionCheck);
app.post(["/session-check", "/SessionCheckServlet", "/api/auth/me", "/AuthCheckServlet", "/auth-check"], handleSessionCheck);

const handleLogout = (req: express.Request, res: express.Response) => {
  const isAjax = req.xhr || req.headers.accept?.includes("json") || req.is("json");
  const onDone = () => {
    res.clearCookie("JSESSIONID");
    res.clearCookie("connect.sid");
    if (!isAjax) {
      return res.redirect(302, "login.html?logout=true");
    }
    return res.json({ success: true, message: "Logged out successfully", redirect: "login.html?logout=true" });
  };

  if (req.session) {
    req.session.destroy(() => {
      onDone();
    });
  } else {
    onDone();
  }
};

app.post(["/logout", "/LogoutServlet", "/api/auth/logout"], handleLogout);
app.get(["/logout", "/LogoutServlet", "/api/auth/logout"], handleLogout);

// Helper auth middleware
function getAuthenticatedUserId(req: express.Request, res: express.Response): number | null {
  const uid = req.session?.userId || req.session?.user_id;
  if (!req.session || !uid) {
    res.status(401).json({ error: "Unauthorized. Please log in to continue." });
    return null;
  }
  return uid;
}

// ==========================================
// PROTECTED APIS WITH USER ISOLATION
// ==========================================

// 1. GET /view-transactions
app.get("/view-transactions", async (req, res) => {
  const userId = getAuthenticatedUserId(req, res);
  if (userId === null) return;

  res.setHeader("Content-Type", "application/json;charset=UTF-8");

  try {
    let resultRows: any[] = [];
    const query = "SELECT id, type, category, amount, title, to_char(transaction_date, 'YYYY-MM-DD') as date FROM transactions WHERE user_id = $1 ORDER BY transaction_date DESC, id DESC;";

    if (externalPgPool) {
      try {
        const extRes = await externalPgPool.query(query, [userId]);
        resultRows = extRes.rows;
      } catch (e: any) {
        console.error("External PG query failed, falling back to local PG:", e.message);
      }
    }

    if (resultRows.length === 0) {
      const result = await db.query<{
        id: number;
        type: string;
        category: string;
        amount: string | number;
        title: string;
        date: string;
      }>(query, [userId]);
      resultRows = result.rows;
    }

    const rows = resultRows.map(r => ({
      id: r.id,
      type: r.type,
      category: r.category,
      amount: parseFloat(String(r.amount)),
      title: r.title,
      date: r.date
    }));

    return res.json(rows);
  } catch (err: any) {
    console.error("PG query error:", err);
    return res.status(500).json({ error: "Database query failed: " + err.message });
  }
});

// 1b. GET /category-expenses
app.get(["/category-expenses", "/view-category-expenses"], async (req, res) => {
  const userId = getAuthenticatedUserId(req, res);
  if (userId === null) return;

  res.setHeader("Content-Type", "application/json;charset=UTF-8");

  try {
    const duration = String(req.query.duration || "this_month");
    let startDate = req.query.start_date ? String(req.query.start_date) : "";
    let endDate = req.query.end_date ? String(req.query.end_date) : "";

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    if (!startDate || !endDate || duration !== "custom") {
      if (duration === "this_month") {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        startDate = firstDay.toISOString().split("T")[0];
        endDate = lastDay.toISOString().split("T")[0];
      } else if (duration === "last_month") {
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);
        startDate = firstDay.toISOString().split("T")[0];
        endDate = lastDay.toISOString().split("T")[0];
      } else if (duration === "last_3_months") {
        const firstDay = new Date(year, month - 2, 1);
        const lastDay = new Date(year, month + 1, 0);
        startDate = firstDay.toISOString().split("T")[0];
        endDate = lastDay.toISOString().split("T")[0];
      } else if (duration === "last_6_months") {
        const firstDay = new Date(year, month - 5, 1);
        const lastDay = new Date(year, month + 1, 0);
        startDate = firstDay.toISOString().split("T")[0];
        endDate = lastDay.toISOString().split("T")[0];
      } else if (duration === "this_year") {
        startDate = `${year}-01-01`;
        endDate = `${year}-12-31`;
      }
    }

    if (!startDate || !endDate) {
      startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];
    }

    const sqlQuery = `
      WITH combined_expenses AS (
        SELECT LOWER(category) as category, amount
        FROM transactions
        WHERE LOWER(type) = 'expense'
          AND user_id = $1
          AND transaction_date >= $2::date
          AND transaction_date <= $3::date
        
        UNION ALL
        
        SELECT LOWER(category) as category, amount
        FROM subscriptions
        WHERE LOWER(status) = 'active'
          AND user_id = $1
          AND next_billing >= $2::date
          AND next_billing <= $3::date
      )
      SELECT category, SUM(amount) as total_amount
      FROM combined_expenses
      GROUP BY category
      ORDER BY total_amount DESC;
    `;

    let resultRows: any[] = [];

    if (externalPgPool) {
      try {
        const extRes = await externalPgPool.query(sqlQuery, [userId, startDate, endDate]);
        resultRows = extRes.rows;
      } catch (e: any) {
        console.error("External PG category expenses query error:", e.message);
      }
    }

    if (resultRows.length === 0) {
      const result = await db.query<{ category: string; total_amount: string | number }>(sqlQuery, [userId, startDate, endDate]);
      resultRows = result.rows;
    }

    const categories = resultRows.map(r => {
      let cat = String(r.category || "others").toLowerCase().trim();
      if (cat === "other") cat = "others";
      const amt = parseFloat(String(r.total_amount || 0));
      const formattedLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
      return {
        category: cat,
        label: formattedLabel,
        totalAmount: amt,
        value: amt
      };
    });

    return res.json({
      startDate,
      endDate,
      duration,
      categories
    });
  } catch (err: any) {
    console.error("PG category expenses query error:", err);
    return res.status(500).json({ error: "Database query failed: " + err.message });
  }
});

// 1c. GET /daily-trends
app.get(["/daily-trends", "/view-daily-trends"], async (req, res) => {
  const userId = getAuthenticatedUserId(req, res);
  if (userId === null) return;

  res.setHeader("Content-Type", "application/json;charset=UTF-8");

  try {
    const duration = String(req.query.duration || "this_month");
    let startDate = req.query.start_date ? String(req.query.start_date) : "";
    let endDate = req.query.end_date ? String(req.query.end_date) : "";

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    if (!startDate || !endDate || duration !== "custom") {
      if (duration === "this_month") {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        startDate = firstDay.toISOString().split("T")[0];
        endDate = lastDay.toISOString().split("T")[0];
      } else if (duration === "last_month") {
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);
        startDate = firstDay.toISOString().split("T")[0];
        endDate = lastDay.toISOString().split("T")[0];
      } else if (duration === "last_3_months") {
        const firstDay = new Date(year, month - 2, 1);
        const lastDay = new Date(year, month + 1, 0);
        startDate = firstDay.toISOString().split("T")[0];
        endDate = lastDay.toISOString().split("T")[0];
      } else if (duration === "last_6_months") {
        const firstDay = new Date(year, month - 5, 1);
        const lastDay = new Date(year, month + 1, 0);
        startDate = firstDay.toISOString().split("T")[0];
        endDate = lastDay.toISOString().split("T")[0];
      } else if (duration === "this_year") {
        startDate = `${year}-01-01`;
        endDate = `${year}-12-31`;
      }
    }

    if (!startDate || !endDate) {
      startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];
    }

    const trendsQuery = `
      WITH combined_events AS (
        SELECT 
          TO_CHAR(transaction_date, 'YYYY-MM-DD') as date_str,
          (CASE WHEN LOWER(type) = 'income' THEN amount ELSE 0 END) as inc,
          (CASE WHEN LOWER(type) = 'expense' THEN amount ELSE 0 END) as exp
        FROM transactions
        WHERE user_id = $1
          AND transaction_date >= $2::date
          AND transaction_date <= $3::date

        UNION ALL

        SELECT 
          TO_CHAR(next_billing, 'YYYY-MM-DD') as date_str,
          0 as inc,
          amount as exp
        FROM subscriptions
        WHERE LOWER(status) = 'active'
          AND user_id = $1
          AND next_billing >= $2::date
          AND next_billing <= $3::date
      )
      SELECT 
        date_str,
        SUM(inc) as income_sum,
        SUM(exp) as expense_sum
      FROM combined_events
      GROUP BY date_str
      ORDER BY date_str ASC;
    `;

    const txQuery = `
      SELECT id, type, category, title, amount, TO_CHAR(transaction_date, 'YYYY-MM-DD') as date
      FROM transactions
      WHERE user_id = $1
        AND transaction_date >= $2::date
        AND transaction_date <= $3::date
      ORDER BY transaction_date DESC, id DESC;
    `;

    let trendRows: any[] = [];
    let txRows: any[] = [];

    if (externalPgPool) {
      try {
        const extTrends = await externalPgPool.query(trendsQuery, [userId, startDate, endDate]);
        trendRows = extTrends.rows;
        const extTxs = await externalPgPool.query(txQuery, [userId, startDate, endDate]);
        txRows = extTxs.rows;
      } catch (e: any) {
        console.error("External PG daily trends query error:", e.message);
      }
    }

    if (trendRows.length === 0 && txRows.length === 0) {
      const resTrends = await db.query(trendsQuery, [userId, startDate, endDate]);
      trendRows = resTrends.rows;
      const resTxs = await db.query(txQuery, [userId, startDate, endDate]);
      txRows = resTxs.rows;
    }

    const dailyTrends = trendRows.map(r => {
      const dStr = String(r.date_str || "");
      const d = new Date(dStr + "T00:00:00");
      const formattedDate = isNaN(d.getTime())
        ? dStr
        : d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });

      return {
        rawDate: dStr,
        formattedDate,
        income: parseFloat(String(r.income_sum || 0)),
        expense: parseFloat(String(r.expense_sum || 0)),
      };
    });

    const formattedTxs = txRows.map(r => ({
      id: Number(r.id),
      type: String(r.type || "expense").toLowerCase(),
      category: String(r.category || "others").toLowerCase(),
      title: String(r.title || ""),
      amount: parseFloat(String(r.amount || 0)),
      date: String(r.date || "")
    }));

    return res.json({
      startDate,
      endDate,
      duration,
      dailyTrends,
      transactions: formattedTxs
    });
  } catch (err: any) {
    console.error("PG daily trends query error:", err);
    return res.status(500).json({ error: "Database query failed: " + err.message });
  }
});

// 2. POST /add-transaction
app.post("/add-transaction", async (req, res) => {
  const userId = getAuthenticatedUserId(req, res);
  if (userId === null) return;

  const type = req.body.type;
  const title = req.body.title;
  const amount = req.body.amount;
  const category = req.body.category;
  const transactionDate = req.body.transaction_date || req.body.date;

  if (!type || !title || !amount || !category || !transactionDate ||
      String(type).trim() === "" || String(title).trim() === "" ||
      String(amount).trim() === "" || String(category).trim() === "" ||
      String(transactionDate).trim() === "") {
    return res.status(400).json({ error: "Please fill all fields." });
  }

  const numAmount = parseFloat(amount);

  try {
    let insertedId: number;
    const insertSql = "INSERT INTO transactions (type, category, amount, title, transaction_date, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;";

    if (externalPgPool) {
      try {
        const extInsert = await externalPgPool.query<{ id: number }>(insertSql, [type, category, numAmount, title, transactionDate, userId]);
        insertedId = extInsert.rows[0]?.id || Date.now();
        await db.query(
          "INSERT INTO transactions (id, type, category, amount, title, transaction_date, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE SET type=$2, category=$3, amount=$4, title=$5, transaction_date=$6, user_id=$7;",
          [insertedId, type, category, numAmount, title, transactionDate, userId]
        );
      } catch (exErr: any) {
        console.error("External PG insert error:", exErr.message);
        const insertRes = await db.query<{ id: number }>(insertSql, [type, category, numAmount, title, transactionDate, userId]);
        insertedId = insertRes.rows[0]?.id || Date.now();
      }
    } else {
      const insertRes = await db.query<{ id: number }>(insertSql, [type, category, numAmount, title, transactionDate, userId]);
      insertedId = insertRes.rows[0]?.id || Date.now();
    }

    return res.json({
      success: true,
      message: "Transaction inserted successfully into PostgreSQL database",
      id: insertedId
    });
  } catch (err: any) {
    console.error("Database insert error:", err);
    return res.status(500).json({ error: "Failed to insert into database: " + err.message });
  }
});

// 3. Delete Transaction
app.all(["/delete-transaction", "/delete-transaction/:id", "/DeleteServlet", "/api/transactions/:id"], async (req, res) => {
  const userId = getAuthenticatedUserId(req, res);
  if (userId === null) return;

  const rawId = req.params?.id || req.body?.id || req.query?.id;

  if (rawId === undefined || rawId === null || String(rawId).trim() === "") {
    return res.status(400).json({ error: "Transaction ID is required for deletion." });
  }

  const numericId = parseInt(String(rawId), 10);
  const targetId = isNaN(numericId) ? String(rawId).trim() : numericId;

  try {
    const deleteSql = "DELETE FROM transactions WHERE id = $1 AND user_id = $2;";
    let extRowsAffected = 0;
    let localRowsAffected = 0;

    if (externalPgPool) {
      try {
        const extResult = await externalPgPool.query(deleteSql, [targetId, userId]);
        extRowsAffected = extResult.rowCount || 0;
      } catch (e: any) {}
    }

    try {
      const localResult = await db.query(deleteSql, [targetId, userId]);
      localRowsAffected = (localResult as any).affectedRows || (localResult as any).rowCount || 0;
    } catch (e: any) {}

    return res.json({
      success: true,
      message: "Transaction deleted successfully from PostgreSQL database",
      deletedId: targetId
    });
  } catch (err: any) {
    console.error("PG delete query error:", err);
    return res.status(500).json({ error: "Failed to delete transaction from database: " + err.message });
  }
});

// 3b. POST /edit-transaction
app.post(["/edit-transaction", "/EditServlet", "/EditTransactionServlet"], async (req, res) => {
  const userId = getAuthenticatedUserId(req, res);
  if (userId === null) return;

  const id = req.body.id;
  const type = req.body.type;
  const title = req.body.title;
  const amount = req.body.amount;
  const category = req.body.category;
  const transactionDate = req.body.transaction_date || req.body.date;

  if (!id || !type || !title || !amount || !category || !transactionDate) {
    return res.status(400).json({ error: "All fields including ID are required for edit." });
  }

  const numAmount = parseFloat(amount);

  try {
    const updateSql = "UPDATE transactions SET type = $1, category = $2, amount = $3, title = $4, transaction_date = $5 WHERE id = $6 AND user_id = $7;";
    
    await db.query(updateSql, [type, category, numAmount, title, transactionDate, id, userId]);

    if (externalPgPool) {
      try {
        await externalPgPool.query(updateSql, [type, category, numAmount, title, transactionDate, id, userId]);
      } catch (e: any) {
        console.error("External PG edit error:", e.message);
      }
    }

    return res.json({ success: true, message: "Transaction updated in PostgreSQL database" });
  } catch (err: any) {
    console.error("PG edit error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Subscriptions APIs
app.get("/api/subscriptions", async (req, res) => {
  const userId = getAuthenticatedUserId(req, res);
  if (userId === null) return;

  try {
    const query = "SELECT id, name, category, amount, billing_cycle as \"billingCycle\", next_billing as \"nextBilling\", status FROM subscriptions WHERE user_id = $1 ORDER BY next_billing ASC, id DESC;";
    const targetPool: any = externalPgPool || db;
    const result = await targetPool.query(query, [userId]);
    const rows = result.rows.map((row: any) => ({
      ...row,
      amount: parseFloat(row.amount),
      nextBilling: row.nextBilling ? new Date(row.nextBilling).toISOString().split("T")[0] : ""
    }));
    return res.json(rows);
  } catch (err: any) {
    console.error("Fetch subscriptions error:", err.message);
    return res.json([]);
  }
});

app.post("/api/subscriptions", async (req, res) => {
  const userId = getAuthenticatedUserId(req, res);
  if (userId === null) return;

  const { name, category, amount, billingCycle, nextBilling } = req.body;
  if (!name || !amount) {
    return res.status(400).json({ error: "Name and Amount are required." });
  }

  const numAmount = parseFloat(amount);
  const cat = category || "bills";
  const cycle = billingCycle || "Monthly";
  const date = nextBilling || new Date().toISOString().split("T")[0];

  try {
    const insertSql = "INSERT INTO subscriptions (name, category, amount, billing_cycle, next_billing, status, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7);";
    
    await db.query(insertSql, [name, cat, numAmount, cycle, date, "Active", userId]);

    if (externalPgPool) {
      try {
        await externalPgPool.query(insertSql, [name, cat, numAmount, cycle, date, "Active", userId]);
      } catch (e: any) {
        console.error("External PG sub insert error:", e.message);
      }
    }

    return res.json({ success: true, message: "Subscription added to Supabase PostgreSQL" });
  } catch (err: any) {
    console.error("Add subscription error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/subscriptions/delete", async (req, res) => {
  const userId = getAuthenticatedUserId(req, res);
  if (userId === null) return;

  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: "Subscription ID required." });
  }

  try {
    const deleteSql = "DELETE FROM subscriptions WHERE id = $1 AND user_id = $2;";
    await db.query(deleteSql, [id, userId]);
    if (externalPgPool) {
      try {
        await externalPgPool.query(deleteSql, [id, userId]);
      } catch (e: any) {}
    }
    return res.json({ success: true, message: "Subscription deleted from Supabase PostgreSQL" });
  } catch (err: any) {
    console.error("Delete subscription error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/subscriptions/update", async (req, res) => {
  const userId = getAuthenticatedUserId(req, res);
  if (userId === null) return;

  const { id, name, category, amount, billingCycle, nextBilling } = req.body;
  if (!id || !name || !amount) {
    return res.status(400).json({ error: "Subscription ID, Name, and Amount are required." });
  }

  const numAmount = parseFloat(amount);
  const cat = category || "bills";
  const cycle = billingCycle || "Monthly";
  const date = nextBilling || new Date().toISOString().split("T")[0];

  try {
    const updateSql = "UPDATE subscriptions SET name = $1, category = $2, amount = $3, billing_cycle = $4, next_billing = $5 WHERE id = $6 AND user_id = $7;";
    
    await db.query(updateSql, [name, cat, numAmount, cycle, date, id, userId]);

    if (externalPgPool) {
      try {
        await externalPgPool.query(updateSql, [name, cat, numAmount, cycle, date, id, userId]);
      } catch (e: any) {
        console.error("External PG sub update error:", e.message);
      }
    }

    return res.json({ success: true, message: "Subscription updated successfully" });
  } catch (err: any) {
    console.error("Update subscription error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// DB Status & Config APIs
app.get("/api/db-status", async (req, res) => {
  try {
    const result = await db.query<{ count: string }>("SELECT COUNT(*) as count FROM transactions;");
    let extCount = 0;
    let isExtActive = false;

    if (externalPgPool) {
      try {
        const extRes = await externalPgPool.query<{ count: string }>("SELECT COUNT(*) as count FROM transactions;");
        extCount = parseInt(extRes.rows[0]?.count || "0", 10);
        isExtActive = true;
      } catch (e) {}
    }

    res.json({
      status: "Connected & Active",
      engine: isExtActive ? "External PostgreSQL Cloud Database" : "Embedded PostgreSQL Engine",
      isExternalConnected: isExtActive,
      totalRecords: isExtActive ? extCount : parseInt(result.rows[0]?.count || "0", 10),
      currentUrl: currentDbUrl ? currentDbUrl.replace(/:[^:@]+@/, ":****@") : "Embedded PostgreSQL"
    });
  } catch (err: any) {
    res.status(500).json({ status: "Error", error: err.message });
  }
});

app.get("/api/db-config", (req, res) => {
  res.json({
    db_url: currentDbUrl,
    isConnected: externalPgPool !== null
  });
});

app.post("/api/db-config", async (req, res) => {
  const newUrl = req.body.db_url ? String(req.body.db_url).trim() : "";

  if (!newUrl) {
    return res.status(400).json({ error: "Please enter a valid PostgreSQL URL string." });
  }

  const testPool = initExternalPgPool(newUrl);

  if (!testPool) {
    return res.status(400).json({ error: "Invalid connection string format." });
  }

  try {
    await testPool.query("SELECT 1;");

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        type VARCHAR(20) NOT NULL,
        category VARCHAR(50) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        title VARCHAR(255) NOT NULL,
        transaction_date DATE NOT NULL,
        user_id INTEGER
      );
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        billing_cycle VARCHAR(50) NOT NULL DEFAULT 'Monthly',
        next_billing DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Active',
        user_id INTEGER
      );
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id INTEGER;
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS user_id INTEGER;
    `);

    if (externalPgPool) {
      try { await externalPgPool.end(); } catch (e) {}
    }
    externalPgPool = testPool;
    currentDbUrl = newUrl;

    fs.writeFileSync(DB_CONFIG_FILE, JSON.stringify({ db_url: newUrl }, null, 2));

    return res.json({
      success: true,
      message: "Successfully connected to your PostgreSQL database! Schema verified."
    });
  } catch (err: any) {
    return res.status(500).json({
      error: "Connection failed: " + err.message + ". Please check hostname, port, user, password, and SSL settings."
    });
  }
});

// Java Code Inspector Endpoint
app.get("/api/java-code", (req, res) => {
  try {
    const findFile = (relPath: string) => {
      const candidates = [
        path.join(currentDir, relPath),
        path.join(process.cwd(), "backend", relPath),
        path.join(process.cwd(), relPath)
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) return fs.readFileSync(p, "utf-8");
      }
      return "// File located in Java project repository";
    };

    const dbJava = findFile("src/main/java/database/Db.java");
    const dbInitializer = findFile("src/main/java/database/DatabaseInitializer.java");
    const passwordUtils = findFile("src/main/java/util/PasswordUtils.java");
    const loginServlet = findFile("src/main/java/servlet/LoginServlet.java");
    const signupServlet = findFile("src/main/java/servlet/SignupServlet.java");
    const logoutServlet = findFile("src/main/java/servlet/LogoutServlet.java");
    const authCheckServlet = findFile("src/main/java/servlet/AuthCheckServlet.java");
    const viewServlet = findFile("src/main/java/servlet/ViewTransactionsServlet.java");
    const addServlet = findFile("src/main/java/servlet/AddTransactionServlet.java");
    const editServlet = findFile("src/main/java/servlet/EditTransactionServlet.java");
    const deleteServlet = findFile("src/main/java/servlet/DeleteTransactionServlet.java");
    const subscriptionsServlet = findFile("src/main/java/servlet/SubscriptionsServlet.java");
    const deleteSubServlet = findFile("src/main/java/servlet/DeleteSubscriptionServlet.java");
    const categoryExpensesServlet = findFile("src/main/java/servlet/CategoryExpensesServlet.java");
    const dailyTrendsServlet = findFile("src/main/java/servlet/DailyTrendsServlet.java");
    const schemaSql = findFile("schema.sql");
    const webXml = findFile("src/main/webapp/WEB-INF/web.xml");

    res.json({
      dbJava,
      dbInitializer,
      passwordUtils,
      loginServlet,
      signupServlet,
      logoutServlet,
      authCheckServlet,
      viewServlet,
      addServlet,
      editServlet,
      deleteServlet,
      subscriptionsServlet,
      deleteSubServlet,
      categoryExpensesServlet,
      dailyTrendsServlet,
      schemaSql,
      webXml,
      dbUrl: currentDbUrl ? currentDbUrl.replace(/^postgres(ql)?:\/\//, "jdbc:postgresql://") : "jdbc:postgresql://[CONFIGURED_IN_ENV]:5432/postgres",
      dbUser: process.env.SUPABASE_USER || "postgres",
      dbPass: "[CONFIGURED_VIA_ENV]"
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Health check endpoint for Render / monitoring
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Expense Tracker Backend",
    mode: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString()
  });
});

// Vite & Static file handling
async function startServer() {
  const frontendDir = fs.existsSync(path.resolve(currentDir, "../frontend"))
    ? path.resolve(currentDir, "../frontend")
    : fs.existsSync(path.resolve(process.cwd(), "frontend"))
    ? path.resolve(process.cwd(), "frontend")
    : process.cwd();

  const distPath = fs.existsSync(path.resolve(currentDir, "../frontend/dist"))
    ? path.resolve(currentDir, "../frontend/dist")
    : fs.existsSync(path.resolve(process.cwd(), "frontend/dist"))
    ? path.resolve(process.cwd(), "frontend/dist")
    : fs.existsSync(path.resolve(process.cwd(), "dist"))
    ? path.resolve(process.cwd(), "dist")
    : path.resolve(currentDir, "dist");

  if (process.env.NODE_ENV !== "production") {
    try {
      const vite = await createViteServer({
        root: frontendDir,
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (viteErr: any) {
      console.warn("Vite middleware fallback:", viteErr.message);
      if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
      }
    }
  } else if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    // Standalone Render backend API root
    app.get("/", (req, res) => {
      res.json({
        service: "Expense Tracker Backend API",
        status: "active",
        health: "/api/health"
      });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Expense Tracker Backend running on port ${PORT}`);
  });
}

startServer();
