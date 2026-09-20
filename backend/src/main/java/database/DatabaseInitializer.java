package database;

import util.PasswordUtils;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.SQLException;

public class DatabaseInitializer {

    public static void initialize() {
        String createUsersTableSql = "CREATE TABLE IF NOT EXISTS users ("
                + "id SERIAL PRIMARY KEY, "
                + "name VARCHAR(255) NOT NULL, "
                + "email VARCHAR(255) UNIQUE NOT NULL, "
                + "password_hash VARCHAR(255) NOT NULL, "
                + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
                + ");";

        String createTransactionsTableSql = "CREATE TABLE IF NOT EXISTS transactions ("
                + "id SERIAL PRIMARY KEY, "
                + "type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')), "
                + "category VARCHAR(50) NOT NULL, "
                + "amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0), "
                + "title VARCHAR(255) NOT NULL, "
                + "transaction_date DATE NOT NULL DEFAULT CURRENT_DATE, "
                + "user_id INTEGER REFERENCES users(id), "
                + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
                + ");";

        String alterTransactionsSql = "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id INTEGER;";

        String createIndexSql = "CREATE INDEX IF NOT EXISTS idx_transactions_date "
                + "ON transactions(transaction_date DESC);";

        String createSubscriptionsTableSql = "CREATE TABLE IF NOT EXISTS subscriptions ("
                + "id SERIAL PRIMARY KEY, "
                + "name VARCHAR(255) NOT NULL, "
                + "category VARCHAR(50) NOT NULL, "
                + "amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0), "
                + "billing_cycle VARCHAR(50) NOT NULL DEFAULT 'Monthly', "
                + "next_billing DATE NOT NULL, "
                + "status VARCHAR(20) NOT NULL DEFAULT 'Active', "
                + "user_id INTEGER REFERENCES users(id), "
                + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
                + ");";

        String alterSubscriptionsSql = "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS user_id INTEGER;";

        try (
            Connection con = Db.getConnection();
            Statement stmt = con.createStatement()
        ) {
            stmt.execute(createUsersTableSql);
            stmt.execute(createTransactionsTableSql);
            stmt.execute(alterTransactionsSql);
            stmt.execute(createIndexSql);
            stmt.execute(createSubscriptionsTableSql);
            stmt.execute(alterSubscriptionsSql);

            // Ensure demo user exists
            String demoEmail = "demo@expensetracker.com";
            String checkUserSql = "SELECT id FROM users WHERE LOWER(email) = LOWER(?)";
            try (PreparedStatement psCheck = con.prepareStatement(checkUserSql)) {
                psCheck.setString(1, demoEmail);
                try (ResultSet rs = psCheck.executeQuery()) {
                    if (!rs.next()) {
                        String passHash = PasswordUtils.hashPassword("password123");
                        String insertDemoSql = "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)";
                        try (PreparedStatement psIns = con.prepareStatement(insertDemoSql)) {
                            psIns.setString(1, "Demo User");
                            psIns.setString(2, demoEmail);
                            psIns.setString(3, passHash);
                            psIns.executeUpdate();
                        }
                    }
                }
            }

            System.out.println("✅ Supabase PostgreSQL database tables (users, transactions & subscriptions) initialized successfully.");
        } catch (SQLException | ClassNotFoundException e) {
            System.err.println("❌ Database initialization error: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
