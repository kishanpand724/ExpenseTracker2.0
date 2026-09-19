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
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      type VARCHAR(20) NOT NULL,
      category VARCHAR(50) NOT NULL,
      amount NUMERIC(12, 2) NOT NULL,
      title VARCHAR(255) NOT NULL,
      transaction_date DATE NOT NULL
    );
  `;

  await db.query(createTableQuery);

  if (externalPgPool) {
    try {
      await externalPgPool.query(createTableQuery);
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

// 3. POST /delete-transaction (SQL DELETE FROM transactions)
app.post("/delete-transaction", async (req, res) => {
  const id = req.body.id || req.query.id;

  if (!id) {
    return res.status(400).json({ error: "Transaction ID is required" });
  }

  try {
    await db.query("DELETE FROM transactions WHERE id = $1;", [id]);
    if (externalPgPool) {
      try {
        await externalPgPool.query("DELETE FROM transactions WHERE id = $1;", [id]);
      } catch (e: any) {}
    }

    if (req.headers["accept"]?.includes("application/json") || req.xhr) {
      return res.json({ success: true, message: "Transaction deleted from PostgreSQL database" });
    }
    return res.redirect("/index.html");
  } catch (err: any) {
    console.error("PG delete error:", err);
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
app.get("/api/subscriptions", (req, res) => {
  res.json(getLocalSubscriptions());
});

app.post("/api/subscriptions", (req, res) => {
  const { name, category, amount, billingCycle, nextBilling } = req.body;
  if (!name || !amount) {
    return res.status(400).json({ error: "Name and Amount are required." });
  }
  const subs = getLocalSubscriptions();
  const newSub = {
    id: Date.now(),
    name,
    category: category || "bills",
    amount: parseFloat(amount),
    billingCycle: billingCycle || "Monthly",
    nextBilling: nextBilling || new Date().toISOString().split("T")[0],
    status: "Active"
  };
  subs.push(newSub);
  saveLocalSubscriptions(subs);
  res.json({ success: true, subscription: newSub });
});

app.post("/api/subscriptions/delete", (req, res) => {
  const { id } = req.body;
  let subs = getLocalSubscriptions();
  subs = subs.filter((s: any) => String(s.id) !== String(id));
  saveLocalSubscriptions(subs);
  res.json({ success: true });
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
