package servlet;

import database.Db;
import java.io.IOException;
import java.io.BufferedReader;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.Date;
import java.sql.SQLException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

/**
 * AddTransactionServlet inserts a new transaction assigned to the logged-in user (user_id).
 */
@WebServlet("/add-transaction")
public class AddTransactionServlet extends HttpServlet {

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
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        setCorsHeaders(request, response);
        request.setCharacterEncoding("UTF-8");
        response.setContentType("application/json;charset=UTF-8");

        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("user_id") == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().println("{\"error\":\"Unauthorized. Please log in to continue.\"}");
            return;
        }

        Object userIdObj = session.getAttribute("user_id");
        int userId = 0;
        if (userIdObj instanceof Number) {
            userId = ((Number) userIdObj).intValue();
        } else {
            try {
                userId = Integer.parseInt(userIdObj.toString());
            } catch (Exception e) {
                userId = 0;
            }
        }

        if (userId <= 0) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().println("{\"error\":\"Unauthorized. Please log in to continue.\"}");
            return;
        }

        String type = request.getParameter("type");
        String title = request.getParameter("title");
        String amountParam = request.getParameter("amount");
        String category = request.getParameter("category");
        String transactionDate = request.getParameter("transaction_date");

        if (transactionDate == null || transactionDate.trim().isEmpty()) {
            transactionDate = request.getParameter("date");
        }

        // Parse JSON if parameters are empty
        if ((type == null || type.trim().isEmpty()) && request.getContentType() != null && request.getContentType().contains("application/json")) {
            StringBuilder sb = new StringBuilder();
            try (BufferedReader reader = request.getReader()) {
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
            }
            String jsonBody = sb.toString();
            type = extractJsonValue(jsonBody, "type");
            title = extractJsonValue(jsonBody, "title");
            amountParam = extractJsonValue(jsonBody, "amount");
            category = extractJsonValue(jsonBody, "category");
            transactionDate = extractJsonValue(jsonBody, "transaction_date");
            if (transactionDate == null || transactionDate.isEmpty()) {
                transactionDate = extractJsonValue(jsonBody, "date");
            }
        }

        if (type == null || title == null || amountParam == null || category == null || transactionDate == null
                || type.trim().isEmpty() || title.trim().isEmpty() || amountParam.trim().isEmpty()
                || category.trim().isEmpty() || transactionDate.trim().isEmpty()) {

            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().println("{\"error\":\"Please fill all fields.\"}");
            return;
        }

        double amount;
        try {
            amount = Double.parseDouble(amountParam);
        } catch (NumberFormatException e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().println("{\"error\":\"Invalid numeric amount.\"}");
            return;
        }

        String sql = "INSERT INTO transactions (type, category, amount, title, transaction_date, user_id) VALUES (?, ?, ?, ?, ?, ?)";

        try (
            Connection con = Db.getConnection();
            PreparedStatement ps = con.prepareStatement(sql)
        ) {
            ps.setString(1, type.trim().toLowerCase());
            ps.setString(2, category);
            ps.setDouble(3, amount);
            ps.setString(4, title);
            ps.setDate(5, Date.valueOf(transactionDate));
            ps.setInt(6, userId);

            ps.executeUpdate();

            response.getWriter().println("{\"success\":true,\"message\":\"Transaction saved to Supabase PostgreSQL.\"}");

        } catch (SQLException | ClassNotFoundException e) {
            e.printStackTrace();
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
