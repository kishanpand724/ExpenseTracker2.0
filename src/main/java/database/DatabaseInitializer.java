package database;

import java.sql.Connection;
import java.sql.Statement;
import java.sql.SQLException;

public class DatabaseInitializer {

    public static void initialize() {
        String createTransactionsTableSql = "CREATE TABLE IF NOT EXISTS transactions ("
                + "id SERIAL PRIMARY KEY, "
                + "type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')), "
                + "category VARCHAR(50) NOT NULL, "
                + "amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0), "
                + "title VARCHAR(255) NOT NULL, "
                + "transaction_date DATE NOT NULL DEFAULT CURRENT_DATE, "
                + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
                + ");";

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
                + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
                + ");";

        try (
            Connection con = Db.getConnection();
            Statement stmt = con.createStatement()
        ) {
            stmt.execute(createTransactionsTableSql);
            stmt.execute(createIndexSql);
            stmt.execute(createSubscriptionsTableSql);

            System.out.println("✅ Supabase PostgreSQL database tables (transactions & subscriptions) initialized successfully.");
        } catch (SQLException | ClassNotFoundException e) {
            System.err.println("❌ Database initialization error: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
