# Expense Tracker

A modern, full-stack personal finance and expense management web application designed for tracking daily income, expenses, recurring subscriptions, and category-level financial analytics.

## Features

- **Transaction Management**: Add, view, filter, edit, and delete financial transactions (income and expense) with categories, amounts, and dates.
- **Financial Dashboard**: Real-time summaries displaying Total Income, Total Expenses, and Remaining Net Balance.
- **Category Analytics**: Visual breakdown of expenses using interactive charts and category trends.
- **Subscription Tracking**: Manage recurring subscriptions with billing cycles and upcoming payment schedules.
- **Authentication**: Secure user sign-up and log-in with session and token support.
- **PostgreSQL Database**: Persistent relational storage supporting hosted PostgreSQL (Supabase, Render PostgreSQL, Cloud SQL, Neon) with schema migrations and seed scripts.
- **Production Architecture**: Decoupled deployment setup ready for Vercel (Frontend) and Render (Backend).

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Recharts, Lucide Icons
- **Backend**: Node.js / Bun, Express, TypeScript, tsx, esbuild
- **Database**: PostgreSQL (`pg`), embedded PGlite engine for local zero-config fallback
- **Authentication & Security**: PBKDF2 / Bcrypt password hashing, express-session, signed auth tokens, CORS

## Project Structure

```text
ExpenseTracker/
├── frontend/
│   ├── src/
│   │   ├── bklitui/         # Chart UI components
│   │   ├── components/      # React widgets and dashboard charts
│   │   ├── config/          # Centralized API configuration (getApiBaseUrl, getAuthHeaders)
│   │   ├── App.tsx          # Main analytics application wrapper
│   │   ├── index.css        # Global Tailwind styling
│   │   └── main.tsx         # Application entry and mounting points
│   ├── public/              # Static assets (favicon, etc.)
│   ├── index.html           # Main dashboard HTML template
│   ├── login.html           # User login interface
│   ├── signup.html          # User registration interface
│   ├── apiConfig.js         # Global API resolver for vanilla and React scripts
│   ├── script.js            # Dashboard interactions and transaction controllers
│   ├── style.css            # Component design system and layout styling
│   ├── package.json         # Frontend package dependencies
│   └── vite.config.ts       # Vite build and dev server configuration
│
├── backend/
│   ├── schema.sql           # PostgreSQL table schemas and indexes
│   ├── server.ts            # Express API server and database connection pool
│   ├── package.json         # Backend package dependencies
│   └── .env.example         # Backend environment variables reference
│
├── .env.example             # Project-wide environment template
├── .gitignore               # Git exclusions (node_modules, dist, .env)
├── package.json             # Root workspace orchestration scripts
├── tsconfig.json            # TypeScript configuration
└── README.md                # Project documentation
```

## Environment Variables

### Frontend (`.env` or Vercel Environment Variables)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `VITE_API_URL` | Base URL of the backend API | `https://expensetracker2-0-jl02.onrender.com` |
| `VITE_BACKEND_URL` | Alternative alias for the backend API URL | `https://expensetracker2-0-jl02.onrender.com` |

### Backend (`backend/.env` or Render Environment Variables)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | Server listening port | `3000` |
| `NODE_ENV` | Environment mode (`development` or `production`) | `production` |
| `FRONTEND_URL` | Allowed frontend origin for CORS | `https://your-frontend.vercel.app` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@host:5432/postgres?sslmode=require` |
| `SESSION_SECRET` | Secret key used to sign sessions and auth tokens | A secure random 32+ character string |

---

## Local Setup & Development

### 1. Prerequisites
- Node.js (v18+) or Bun
- npm or bun
- PostgreSQL database instance (or use the built-in embedded engine)

### 2. Clone and Install Dependencies

```bash
# Clone the repository
git clone <your-repo-url>
cd ExpenseTracker

# Install dependencies
npm install
```

### 3. Configure Local Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

To connect to a custom PostgreSQL database, set `DATABASE_URL` in `.env`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/expense_tracker
```

### 4. Run the Development Server

```bash
# Runs full-stack dev server (Express backend + Vite middleware)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running Frontend and Backend Separately

### Running the Backend

```bash
# From workspace root
npm run dev

# Or from backend directory
cd backend
npm install
npm run dev
```

The backend starts listening on `http://0.0.0.0:3000` and exposes `/health` and `/api/health` probes.

### Running the Frontend

```bash
# From frontend directory
cd frontend
npm install
npm run dev
```

During local frontend-only development, configure `VITE_API_URL=http://localhost:3000` in `frontend/.env`.

---

## PostgreSQL Database Setup

The database schema is defined in `backend/schema.sql`.

### Tables Created:
1. `users` — User credentials, name, email, and password hash.
2. `transactions` — Financial records (type: `income` | `expense`, category, amount, title, transaction_date, user_id).
3. `subscriptions` — Recurring subscriptions (name, category, amount, billing_cycle, next_billing, status, user_id).

### Applying the Schema:

When running with `DATABASE_URL` configured, the server automatically verifies and creates the required tables on initialization.

To manually run the schema using `psql`:

```bash
psql -d "postgresql://postgres:password@your-host:5432/postgres" -f backend/schema.sql
```

---

## Deployment Instructions

### 1. Backend Deployment (Render)

1. Create a new **Web Service** on [Render](https://render.com).
2. Connect your Git repository.
3. Configure the service settings:
   - **Root Directory**: `backend` (or leave empty if using root scripts)
   - **Environment**: `Node`
   - **Build Command**:
     ```bash
     npm install && npm run build
     ```
   - **Start Command**:
     ```bash
     npm start
     ```
4. Set **Environment Variables** in Render dashboard:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render provides this automatically)
   - `DATABASE_URL`: `postgresql://postgres:password@host:5432/dbname?sslmode=require`
   - `FRONTEND_URL`: `https://your-app.vercel.app`
   - `SESSION_SECRET`: `<secure-random-key>`
5. Health Check Path: `/health`
6. Deploy service. Once live, copy your Render service URL (e.g. `https://expensetracker2-0-jl02.onrender.com`).

---

### 2. Frontend Deployment (Vercel)

1. Import your Git repository into [Vercel](https://vercel.com).
2. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./` (or `frontend`)
   - **Build Command**: `npm run build:frontend` (or `npm run build`)
   - **Output Directory**: `dist`
3. Add **Environment Variables**:
   - `VITE_API_URL`: Your Render backend URL (e.g. `https://expensetracker2-0-jl02.onrender.com`)
   - `VITE_BACKEND_URL`: Same Render backend URL
4. Deploy. Vercel will build the frontend assets and serve them globally via CDN.

---

## Architecture Flow

```text
       +-------------------------------+
       |        Vercel Frontend        |
       |  (React 19 / Vite / Tailwind) |
       +---------------+---------------+
                       |
                       | HTTPS / REST APIs
                       v
       +-------------------------------+
       |         Render Backend        |
       |     (Express / Node.js)       |
       |   - CORS Validation           |
       |   - Session & JWT Auth        |
       |   - Health check (/health)    |
       +---------------+---------------+
                       |
                       | SQL / Connection Pool
                       v
       +-------------------------------+
       |      PostgreSQL Database      |
       | (Supabase / Render / Cloud)   |
       +-------------------------------+
```

## License

MIT License. Free for personal and educational use.
