-- PostgreSQL Schema for Personal Expense Tracker
-- Database: expense

CREATE DATABASE expense;

-- Connect to expense database before running the following:
-- \c expense;

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    category VARCHAR(50) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    title VARCHAR(255) NOT NULL,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries on date
CREATE INDEX idx_transactions_date ON transactions(transaction_date DESC);

-- Sample Data Insertion
INSERT INTO transactions (type, category, amount, title, transaction_date) VALUES
('income', 'salary', 50000.00, 'Monthly Salary', '2026-09-16'),
('expense', 'food', 1200.00, 'Dinner with friends', '2026-09-17'),
('expense', 'bills', 2500.00, 'Electricity Bill', '2026-09-15'),
('expense', 'shopping', 4800.00, 'New Headphones', '2026-09-14'),
('expense', 'travel', 850.00, 'Cab Fare to Office', '2026-09-13');
