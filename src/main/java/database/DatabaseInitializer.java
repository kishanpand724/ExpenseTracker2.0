package database;

import java.sql.Connection;
import java.sql.Statement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class DatabaseInitializer {

    public static void initialize() {
        String createTableSql = "CREATE TABLE IF NOT EXISTS transactions ("
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

        String seedDataSql = "INSERT INTO transactions (type, category, amount, title, transaction_date) VALUES "
                + "('income', 'salary', 50000.00, 'Monthly Salary', '2026-09-16'), "
                + "('expense', 'food', 1200.00, 'Dinner with friends', '2026-09-17'), "
                + "('expense', 'bills', 2500.00, 'Electricity Bill', '2026-09-15'), "
                + "('expense', 'shopping', 4800.00, 'New Headphones', '2026-09-14'), "
                + "('expense', 'travel', 850.00, 'Cab Fare to Office', '2026-09-13');";

        try (
            Connection con = Db.getConnection();
            Statement stmt = con.createStatement()
        ) {
            stmt.execute(createTableSql);
            stmt.execute(createIndexSql);

            // Check if table is empty, and seed if needed
            ResultSet rs = stmt.executeQuery("SELECT COUNT(*) AS total FROM transactions;");
            if (rs.next() && rs.getInt("total") == 0) {
                stmt.executeUpdate(seedDataSql);
                System.out.println("🌱 Seeded initial transactions into Supabase PostgreSQL.");
            }

            System.out.println("✅ Supabase PostgreSQL database tables and indexes initialized successfully.");
        } catch (SQLException | ClassNotFoundException e) {
            System.err.println("❌ Database initialization error: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
