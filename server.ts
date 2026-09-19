import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";

const app = express();
const PORT = 3000;

// Body parser middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Initialize PGlite (Embedded PostgreSQL Engine)
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const dbPath = path.join(DATA_DIR, "pgdata");
const db = new PGlite(dbPath);

const DB_CONFIG_FILE = path.join(DATA_DIR, "db_config.json");

// Optional Remote PostgreSQL Pool if external DATABASE_URL provided or saved in config
const DEFAULT_SUPABASE_URL = "postgres://postgres:Kishan%40772244@db.fknwrkisdhwjbnzwnifo.supabase.co:5432/postgres?sslmode=require";
let externalPgPool: Pool | null = null;
let currentDbUrl = process.env.DATABASE_URL || DEFAULT_SUPABASE_URL;

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

// Function to initialize PostgreSQL tables & seeds
async function initDatabase() {
  console.log("Initializing PostgreSQL database...");
  const createTransactionsQuery = `
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      type VARCHAR(20) NOT NULL,
      category VARCHAR(50) NOT NULL,
      amount NUMERIC(12, 2) NOT NULL,
      title VARCHAR(255) NOT NULL,
      transaction_date DATE NOT NULL
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
      status VARCHAR(20) NOT NULL DEFAULT 'Active'
    );
  `;

  await db.query(createTransactionsQuery);
  await db.query(createSubscriptionsQuery);

  if (externalPgPool) {
    try {
      await externalPgPool.query(createTransactionsQuery);
      await externalPgPool.query(createSubscriptionsQuery);
      console.log("Connected to External PostgreSQL pool successfully!");
    } catch (e: any) {
      console.error("External PG connection error:", e.message);
    }
  }

  // Seed initial data if table is empty
  const countRes = await db.query<{ count: string }>("SELECT COUNT(*) as count FROM transactions;");
  if (parseInt(countRes.rows[0]?.count || "0", 10) === 0) {
    console.log("Seeding initial transactions into PostgreSQL database...");
    const seeds = [
      ["expense", "food", 1200, "Dinner with friends", "2026-09-17"],
      ["income", "salary", 50000, "Monthly Salary", "2026-09-16"],
      ["expense", "bills", 2500, "Electricity Bill", "2026-09-15"],
      ["expense", "shopping", 4800, "New Headphones", "2026-09-14"],
      ["expense", "travel", 850, "Cab Fare to Office", "2026-09-13"]
    ];

    for (const seed of seeds) {
      await db.query(
        "INSERT INTO transactions (type, category, amount, title, transaction_date) VALUES ($1, $2, $3, $4, $5);",
        seed
      );
    }
  }
  console.log("PostgreSQL database setup complete!");
}

initDatabase().catch(err => console.error("Database initialization error:", err));

const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, "subscriptions.json");
const initialSubscriptions = [
  { id: 1, name: "Netflix Premium", category: "entertainment", amount: 649, billingCycle: "Monthly", nextBilling: "2026-10-01", status: "Active" },
  { id: 2, name: "Spotify Individual", category: "entertainment", amount: 119, billingCycle: "Monthly", nextBilling: "2026-09-28", status: "Active" },
  { id: 3, name: "Airtel Fiber Broadband", category: "bills", amount: 999, billingCycle: "Monthly", nextBilling: "2026-10-05", status: "Active" }
];

if (!fs.existsSync(SUBSCRIPTIONS_FILE)) {
  fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(initialSubscriptions, null, 2));
}

function getLocalSubscriptions() {
  try {
    const raw = fs.readFileSync(SUBSCRIPTIONS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    return initialSubscriptions;
  }
}

function saveLocalSubscriptions(subs: any[]) {
  fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subs, null, 2));
}

// API Endpoints matching Java Servlets

// 1. GET /view-transactions (SQL SELECT FROM transactions)
app.get("/view-transactions", async (req, res) => {
  res.setHeader("Content-Type", "application/json;charset=UTF-8");

  try {
    let resultRows: any[] = [];

    if (externalPgPool) {
      try {
        const extRes = await externalPgPool.query(
          "SELECT id, type, category, amount, title, to_char(transaction_date, 'YYYY-MM-DD') as date FROM transactions ORDER BY transaction_date DESC, id DESC;"
        );
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
      }>(
        "SELECT id, type, category, amount, title, to_char(transaction_date, 'YYYY-MM-DD') as date FROM transactions ORDER BY transaction_date DESC, id DESC;"
      );
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

// 1b. GET /category-expenses (SQL SUM(amount) GROUP BY category with Date Range Filter)
app.get(["/category-expenses", "/view-category-expenses"], async (req, res) => {
  res.setHeader("Content-Type", "application/json;charset=UTF-8");

  try {
    const duration = String(req.query.duration || "this_month");
    let startDate = req.query.start_date ? String(req.query.start_date) : "";
    let endDate = req.query.end_date ? String(req.query.end_date) : "";

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based

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
          AND transaction_date >= $1::date
          AND transaction_date <= $2::date
        
        UNION ALL
        
        SELECT LOWER(category) as category, amount
        FROM subscriptions
        WHERE LOWER(status) = 'active'
          AND next_billing >= $1::date
          AND next_billing <= $2::date
      )
      SELECT category, SUM(amount) as total_amount
      FROM combined_expenses
      GROUP BY category
      ORDER BY total_amount DESC;
    `;

    let resultRows: any[] = [];

    if (externalPgPool) {
      try {
        const extRes = await externalPgPool.query(sqlQuery, [startDate, endDate]);
        resultRows = extRes.rows;
      } catch (e: any) {
        console.error("External PG category expenses query error:", e.message);
      }
    }

    if (resultRows.length === 0) {
      const result = await db.query<{ category: string; total_amount: string | number }>(sqlQuery, [startDate, endDate]);
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

// 1c. GET /daily-trends (SQL SUM(amount) GROUP BY transaction_date with Date Range Filter)
app.get(["/daily-trends", "/view-daily-trends"], async (req, res) => {
  res.setHeader("Content-Type", "application/json;charset=UTF-8");

  try {
    const duration = String(req.query.duration || "this_month");
    let startDate = req.query.start_date ? String(req.query.start_date) : "";
    let endDate = req.query.end_date ? String(req.query.end_date) : "";

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based

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
        WHERE transaction_date >= $1::date
          AND transaction_date <= $2::date

        UNION ALL

        SELECT 
          TO_CHAR(next_billing, 'YYYY-MM-DD') as date_str,
          0 as inc,
          amount as exp
        FROM subscriptions
        WHERE LOWER(status) = 'active'
          AND next_billing >= $1::date
          AND next_billing <= $2::date
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
      WHERE transaction_date >= $1::date
        AND transaction_date <= $2::date
      ORDER BY transaction_date DESC, id DESC;
    `;

    let trendRows: any[] = [];
    let txRows: any[] = [];

    if (externalPgPool) {
      try {
        const extTrends = await externalPgPool.query(trendsQuery, [startDate, endDate]);
        trendRows = extTrends.rows;
        const extTxs = await externalPgPool.query(txQuery, [startDate, endDate]);
        txRows = extTxs.rows;
      } catch (e: any) {
        console.error("External PG daily trends query error:", e.message);
      }
    }

    if (trendRows.length === 0 && txRows.length === 0) {
      const resTrends = await db.query(trendsQuery, [startDate, endDate]);
      trendRows = resTrends.rows;
      const resTxs = await db.query(txQuery, [startDate, endDate]);
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

// 2. POST /add-transaction (SQL INSERT INTO transactions)
app.post("/add-transaction", async (req, res) => {
  const type = req.body.type;
  const title = req.body.title;
  const amount = req.body.amount;
  const category = req.body.category;
  const transactionDate = req.body.transaction_date || req.body.date;

  console.log("========== ADD TRANSACTION TO DB ==========");
  console.log("TYPE     = " + type);
  console.log("TITLE    = " + title);
  console.log("AMOUNT   = " + amount);
  console.log("CATEGORY = " + category);
  console.log("DATE     = " + transactionDate);
  console.log("===========================================");

  if (!type || !title || !amount || !category || !transactionDate ||
      String(type).trim() === "" || String(title).trim() === "" ||
      String(amount).trim() === "" || String(category).trim() === "" ||
      String(transactionDate).trim() === "") {
    if (req.headers["accept"]?.includes("application/json") || req.xhr) {
      return res.status(400).json({ error: "Please fill all fields." });
    }
    return res.status(400).send("<h2>Please fill all fields.</h2>");
  }

  const numAmount = parseFloat(amount);

  try {
    const insertRes = await db.query<{ id: number }>(
      "INSERT INTO transactions (type, category, amount, title, transaction_date) VALUES ($1, $2, $3, $4, $5) RETURNING id;",
      [type, category, numAmount, title, transactionDate]
    );

    let insertedId = insertRes.rows[0]?.id || Date.now();

    if (externalPgPool) {
      try {
        const extInsert = await externalPgPool.query<{ id: number }>(
          "INSERT INTO transactions (type, category, amount, title, transaction_date) VALUES ($1, $2, $3, $4, $5) RETURNING id;",
          [type, category, numAmount, title, transactionDate]
        );
        if (extInsert.rows[0]?.id) {
          insertedId = extInsert.rows[0].id;
        }
        console.log("Saved transaction to External PostgreSQL DB!");
      } catch (exErr: any) {
        console.error("External PG insert error:", exErr.message);
      }
    }

    console.log("SUCCESSFULLY INSERTED RECORD INTO POSTGRES DB WITH ID:", insertedId);

    if (req.headers["accept"]?.includes("application/json") || req.xhr) {
      return res.json({
        success: true,
        message: "Transaction inserted successfully into PostgreSQL database",
        id: insertedId
      });
    }

    return res.redirect("/index.html");
  } catch (err: any) {
    console.error("Database insert error:", err);
    if (req.headers["accept"]?.includes("application/json") || req.xhr) {
      return res.status(500).json({ error: "Failed to insert into database: " + err.message });
    }
    return res.status(500).send("<h2>Database Error: " + err.message + "</h2>");
  }
});

// 3. POST / DELETE / GET /delete-transaction & /DeleteServlet (SQL DELETE FROM transactions WHERE id = $1)
app.all(["/delete-transaction", "/delete-transaction/:id", "/DeleteServlet", "/api/transactions/:id"], async (req, res) => {
  res.setHeader("Content-Type", "application/json;charset=UTF-8");

  const rawId = req.params?.id || req.body?.id || req.query?.id;

  console.log("========== DELETE TRANSACTION DB REQUEST ==========");
  console.log("Raw ID received = ", rawId);
  console.log("Method = ", req.method);
  console.log("===================================================");

  if (rawId === undefined || rawId === null || String(rawId).trim() === "") {
    return res.status(400).json({ error: "Transaction ID is required for deletion." });
  }

  const numericId = parseInt(String(rawId), 10);
  const targetId = isNaN(numericId) ? String(rawId).trim() : numericId;

  try {
    const deleteSql = "DELETE FROM transactions WHERE id = $1;";
    
    // Execute SQL Prepared Statement
    const result = await db.query(deleteSql, [targetId]);
    console.log(`Deleted ${result.rowCount || 0} rows from embedded PostgreSQL DB for ID:`, targetId);

    if (externalPgPool) {
      try {
        const extResult = await externalPgPool.query(deleteSql, [targetId]);
        console.log(`Deleted ${extResult.rowCount || 0} rows from external PostgreSQL DB for ID:`, targetId);
      } catch (e: any) {
        console.error("External PG delete error:", e.message);
      }
    }

    if (req.headers["accept"]?.includes("application/json") || req.xhr || req.headers["x-requested-with"] === "XMLHttpRequest") {
      return res.json({
        success: true,
        message: "Transaction deleted successfully from PostgreSQL database",
        deletedId: targetId
      });
    }

    return res.redirect("/index.html");
  } catch (err: any) {
    console.error("PG delete query error:", err);
    return res.status(500).json({ error: "Failed to delete transaction from database: " + err.message });
  }
});

// 3b. POST /edit-transaction, /EditServlet, /EditTransactionServlet (SQL UPDATE transactions WHERE id = $1)
app.post(["/edit-transaction", "/EditServlet", "/EditTransactionServlet"], async (req, res) => {
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
    await db.query(
      "UPDATE transactions SET type = $1, category = $2, amount = $3, title = $4, transaction_date = $5 WHERE id = $6;",
      [type, category, numAmount, title, transactionDate, id]
    );

    if (externalPgPool) {
      try {
        await externalPgPool.query(
          "UPDATE transactions SET type = $1, category = $2, amount = $3, title = $4, transaction_date = $5 WHERE id = $6;",
          [type, category, numAmount, title, transactionDate, id]
        );
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

// 4. DB Status & Config APIs
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
    // Test connection
    await testPool.query("SELECT 1;");

    // Ensure schema exists on new pool
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        type VARCHAR(20) NOT NULL,
        category VARCHAR(50) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        title VARCHAR(255) NOT NULL,
        transaction_date DATE NOT NULL
      );
    `);

    // Activate pool
    if (externalPgPool) {
      try { await externalPgPool.end(); } catch (e) {}
    }
    externalPgPool = testPool;
    currentDbUrl = newUrl;

    // Save to file
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

// Subscriptions APIs
app.get("/api/subscriptions", async (req, res) => {
  try {
    const targetPool: any = externalPgPool || db;
    const result = await targetPool.query(
      "SELECT id, name, category, amount, billing_cycle as \"billingCycle\", next_billing as \"nextBilling\", status FROM subscriptions ORDER BY next_billing ASC, id DESC;"
    );
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
  const { name, category, amount, billingCycle, nextBilling } = req.body;
  if (!name || !amount) {
    return res.status(400).json({ error: "Name and Amount are required." });
  }

  const numAmount = parseFloat(amount);
  const cat = category || "bills";
  const cycle = billingCycle || "Monthly";
  const date = nextBilling || new Date().toISOString().split("T")[0];

  try {
    await db.query(
      "INSERT INTO subscriptions (name, category, amount, billing_cycle, next_billing, status) VALUES ($1, $2, $3, $4, $5, $6);",
      [name, cat, numAmount, cycle, date, "Active"]
    );

    if (externalPgPool) {
      try {
        await externalPgPool.query(
          "INSERT INTO subscriptions (name, category, amount, billing_cycle, next_billing, status) VALUES ($1, $2, $3, $4, $5, $6);",
          [name, cat, numAmount, cycle, date, "Active"]
        );
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
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: "Subscription ID required." });
  }

  try {
    await db.query("DELETE FROM subscriptions WHERE id = $1;", [id]);
    if (externalPgPool) {
      try {
        await externalPgPool.query("DELETE FROM subscriptions WHERE id = $1;", [id]);
      } catch (e: any) {}
    }
    return res.json({ success: true, message: "Subscription deleted from Supabase PostgreSQL" });
  } catch (err: any) {
    console.error("Delete subscription error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Java Code Inspector Endpoint for user viewing
app.get("/api/java-code", (req, res) => {
  try {
    const dbJava = fs.readFileSync(path.join(process.cwd(), "src/main/java/database/Db.java"), "utf-8");
    const testDbJava = fs.readFileSync(path.join(process.cwd(), "src/main/java/database/TestDB.java"), "utf-8");
    const viewServlet = fs.readFileSync(path.join(process.cwd(), "src/main/java/servlet/ViewTransactionsServlet.java"), "utf-8");
    const addServlet = fs.readFileSync(path.join(process.cwd(), "src/main/java/servlet/AddTransactionServlet.java"), "utf-8");
    const schemaSql = fs.readFileSync(path.join(process.cwd(), "schema.sql"), "utf-8");
    const webXml = fs.readFileSync(path.join(process.cwd(), "src/main/webapp/WEB-INF/web.xml"), "utf-8");

    res.json({
      dbJava,
      testDbJava,
      viewServlet,
      addServlet,
      schemaSql,
      webXml,
      dbUrl: "jdbc:postgresql://db.fknwrkisdhwjbnzwnifo.supabase.co:5432/postgres?sslmode=require",
      dbUser: "postgres",
      dbPass: "[SECURE_ENV_VAR]"
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Vite & Static file handling
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
