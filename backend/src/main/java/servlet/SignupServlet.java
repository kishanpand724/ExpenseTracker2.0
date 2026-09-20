package servlet;

import database.Db;
import util.PasswordUtils;

import java.io.BufferedReader;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

/**
 * SignupServlet handles user account registration using Java JDBC,
 * password hashing, unique email checks, and PostgreSQL storage.
 */
@WebServlet(name = "SignupServlet", urlPatterns = {"/SignupServlet", "/signup", "/api/auth/signup"})
public class SignupServlet extends HttpServlet {

    private void setCorsHeaders(HttpServletRequest request, HttpServletResponse response) {
        String origin = request.getHeader("Origin");
        if (origin != null && !origin.isEmpty()) {
            response.setHeader("Access-Control-Allow-Origin", origin);
            response.setHeader("Access-Control-Allow-Credentials", "true");
        } else {
            response.setHeader("Access-Control-Allow-Origin", "*");
        }
        response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept");
    }

    @Override
    protected void doOptions(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        setCorsHeaders(request, response);
        response.setStatus(HttpServletResponse.SC_OK);
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.sendRedirect(request.getContextPath() + "/signup.html");
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        setCorsHeaders(request, response);
        request.setCharacterEncoding("UTF-8");

        String name = request.getParameter("name");
        String email = request.getParameter("email");
        String password = request.getParameter("password");
        String confirmPassword = request.getParameter("confirmPassword");

        // Parse JSON if parameters are empty
        if ((name == null || name.trim().isEmpty()) && request.getContentType() != null && request.getContentType().contains("application/json")) {
            StringBuilder sb = new StringBuilder();
            try (BufferedReader reader = request.getReader()) {
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
            }
            String jsonBody = sb.toString();
            name = extractJsonValue(jsonBody, "name");
            email = extractJsonValue(jsonBody, "email");
            password = extractJsonValue(jsonBody, "password");
            confirmPassword = extractJsonValue(jsonBody, "confirmPassword");
        }

        boolean isAjax = "XMLHttpRequest".equalsIgnoreCase(request.getHeader("X-Requested-With"))
                || (request.getHeader("Accept") != null && request.getHeader("Accept").contains("application/json"))
                || (request.getContentType() != null && request.getContentType().contains("application/json"));

        if (name == null || email == null || password == null || confirmPassword == null ||
            name.trim().isEmpty() || email.trim().isEmpty() || password.trim().isEmpty()) {
            if (!isAjax) {
                response.sendRedirect(request.getContextPath() + "/signup.html?error=" + java.net.URLEncoder.encode("All fields are required.", "UTF-8"));
                return;
            }
            response.setContentType("application/json;charset=UTF-8");
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().println("{\"error\":\"All fields are required.\"}");
            return;
        }

        String cleanName = name.trim();
        String cleanEmail = email.trim().toLowerCase();

        if (!cleanEmail.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            if (!isAjax) {
                response.sendRedirect(request.getContextPath() + "/signup.html?error=" + java.net.URLEncoder.encode("Please enter a valid email address.", "UTF-8"));
                return;
            }
            response.setContentType("application/json;charset=UTF-8");
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().println("{\"error\":\"Please enter a valid email address.\"}");
            return;
        }

        if (password.length() < 6) {
            if (!isAjax) {
                response.sendRedirect(request.getContextPath() + "/signup.html?error=" + java.net.URLEncoder.encode("Password must be at least 6 characters long.", "UTF-8"));
                return;
            }
            response.setContentType("application/json;charset=UTF-8");
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().println("{\"error\":\"Password must be at least 6 characters long.\"}");
            return;
        }

        if (!password.equals(confirmPassword)) {
            if (!isAjax) {
                response.sendRedirect(request.getContextPath() + "/signup.html?error=" + java.net.URLEncoder.encode("Password and Confirm Password do not match.", "UTF-8"));
                return;
            }
            response.setContentType("application/json;charset=UTF-8");
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().println("{\"error\":\"Password and Confirm Password do not match.\"}");
            return;
        }

        String checkSql = "SELECT id FROM users WHERE LOWER(email) = ?";
        String insertSql = "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)";

        try (Connection con = Db.getConnection()) {

            // 1. Check if email already exists
            try (PreparedStatement checkPs = con.prepareStatement(checkSql)) {
                checkPs.setString(1, cleanEmail);
                try (ResultSet rs = checkPs.executeQuery()) {
                    if (rs.next()) {
                        if (!isAjax) {
                            response.sendRedirect(request.getContextPath() + "/signup.html?error=" + java.net.URLEncoder.encode("An account with this email address already exists. Please log in.", "UTF-8"));
                            return;
                        }
                        response.setContentType("application/json;charset=UTF-8");
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        response.getWriter().println("{\"error\":\"An account with this email address already exists. Please log in.\"}");
                        return;
                    }
                }
            }

            // 2. Hash password securely using PBKDF2
            String passwordHash = PasswordUtils.hashPassword(password);

            // 3. Insert new user using PreparedStatement
            int newUserId = -1;
            try (PreparedStatement insertPs = con.prepareStatement(insertSql, Statement.RETURN_GENERATED_KEYS)) {
                insertPs.setString(1, cleanName);
                insertPs.setString(2, cleanEmail);
                insertPs.setString(3, passwordHash);

                insertPs.executeUpdate();

                try (ResultSet keys = insertPs.getGeneratedKeys()) {
                    if (keys.next()) {
                        newUserId = keys.getInt(1);
                    }
                }
            }

            // Store in HttpSession
            HttpSession session = request.getSession(true);
            session.setAttribute("user_id", newUserId);
            session.setAttribute("user_name", cleanName);
            session.setAttribute("user_email", cleanEmail);

            if (!isAjax) {
                response.sendRedirect(request.getContextPath() + "/login.html?registered=true");
                return;
            }

            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().println(
                "{\"success\":true,\"message\":\"Account created successfully.\","
                + "\"redirect\":\"" + escapeJson(request.getContextPath() + "/login.html?registered=true") + "\","
                + "\"user\":{\"id\":" + newUserId + ",\"name\":\"" + escapeJson(cleanName) + "\",\"email\":\"" + escapeJson(cleanEmail) + "\"}}"
            );

        } catch (SQLException | ClassNotFoundException e) {
            e.printStackTrace();
            if (!isAjax) {
                response.sendRedirect(request.getContextPath() + "/signup.html?error=" + java.net.URLEncoder.encode("Database error: " + e.getMessage(), "UTF-8"));
                return;
            }
            response.setContentType("application/json;charset=UTF-8");
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().println("{\"error\":\"Database error: " + escapeJson(e.getMessage()) + "\"}");
        }
    }

    private String extractJsonValue(String json, String key) {
        String search = "\"" + key + "\":";
        int idx = json.indexOf(search);
        if (idx == -1) return null;
        int start = idx + search.length();
        while (start < json.length() && (json.charAt(start) == ' ' || json.charAt(start) == '"')) {
            start++;
        }
        int end = start;
        while (end < json.length() && json.charAt(end) != '"' && json.charAt(end) != ',' && json.charAt(end) != '}') {
            end++;
        }
        return json.substring(start, end).trim();
    }

    private String escapeJson(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
