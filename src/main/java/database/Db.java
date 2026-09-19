package database;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

/**
 * Database Utility Class for Java Servlets (JDBC Connection Manager)
 * Connects Java Servlet Backend to Supabase Cloud PostgreSQL via JDBC.
 */
public class Db {

    // Default configuration for Supabase PostgreSQL database
    private static final String DEFAULT_HOST = "db.fknwrkisdhwjbnzwnifo.supabase.co";
    private static final String DEFAULT_PORT = "5432";
    private static final String DEFAULT_DB = "postgres";
    private static final String DEFAULT_USER = "postgres";

    /**
     * Establishes a JDBC Connection to Supabase PostgreSQL database.
     * Uses environment variables (DATABASE_URL or SUPABASE_*) when present,
     * maintaining high security by keeping database credentials in backend configuration.
     */
    public static Connection getConnection() throws SQLException, ClassNotFoundException {
        // Load PostgreSQL JDBC Driver
        Class.forName("org.postgresql.Driver");

        // 1. Check for full DATABASE_URL environment variable
        String envUrl = System.getenv("DATABASE_URL");
        if (envUrl != null && !envUrl.trim().isEmpty()) {
            String jdbcUrl = envUrl.trim();
            if (jdbcUrl.startsWith("postgres://")) {
                jdbcUrl = jdbcUrl.replace("postgres://", "jdbc:postgresql://");
            } else if (jdbcUrl.startsWith("postgresql://")) {
                jdbcUrl = jdbcUrl.replace("postgresql://", "jdbc:postgresql://");
            }
            if (!jdbcUrl.contains("sslmode=")) {
                jdbcUrl += (jdbcUrl.contains("?") ? "&" : "?") + "sslmode=require";
            }
            return DriverManager.getConnection(jdbcUrl);
        }

        // 2. Read individual Supabase connection configuration parameters
        String host = getEnv("SUPABASE_HOST", DEFAULT_HOST);
        String port = getEnv("SUPABASE_PORT", DEFAULT_PORT);
        String dbName = getEnv("SUPABASE_DB", DEFAULT_DB);
        String user = getEnv("SUPABASE_USER", DEFAULT_USER);
        String password = getEnv("SUPABASE_PASSWORD", "Kishan@772244");

        String jdbcUrl = String.format("jdbc:postgresql://%s:%s/%s?sslmode=require", host, port, dbName);
        return DriverManager.getConnection(jdbcUrl, user, password);
    }

    /**
     * Overloaded method to connect using explicit custom JDBC URL, username, and password.
     */
    public static Connection getConnection(String url, String username, String password)
            throws SQLException, ClassNotFoundException {

        Class.forName("org.postgresql.Driver");
        return DriverManager.getConnection(url, username, password);
    }

    private static String getEnv(String name, String defaultValue) {
        String val = System.getenv(name);
        return (val != null && !val.trim().isEmpty()) ? val.trim() : defaultValue;
    }
}
