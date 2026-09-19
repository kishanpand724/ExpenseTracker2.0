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

@WebServlet("/edit-transaction")
public class EditTransactionServlet extends HttpServlet {

    private void setCorsHeaders(HttpServletResponse response) {
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }

    @Override
    protected void doOptions(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        setCorsHeaders(response);
        response.setStatus(HttpServletResponse.SC_OK);
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        setCorsHeaders(response);
        request.setCharacterEncoding("UTF-8");

        String idParam = request.getParameter("id");
        String type = request.getParameter("type");
        String title = request.getParameter("title");
        String amountParam = request.getParameter("amount");
        String category = request.getParameter("category");
        String transactionDate = request.getParameter("transaction_date");

        if (transactionDate == null || transactionDate.trim().isEmpty()) {
            transactionDate = request.getParameter("date");
        }

        // Parse JSON if form body is empty
        if ((idParam == null || idParam.trim().isEmpty()) && request.getContentType() != null && request.getContentType().contains("application/json")) {
            StringBuilder sb = new StringBuilder();
            try (BufferedReader reader = request.getReader()) {
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
            }
            String jsonBody = sb.toString();
            idParam = extractJsonValue(jsonBody, "id");
            type = extractJsonValue(jsonBody, "type");
            title = extractJsonValue(jsonBody, "title");
            amountParam = extractJsonValue(jsonBody, "amount");
            category = extractJsonValue(jsonBody, "category");
            transactionDate = extractJsonValue(jsonBody, "date");
            if (transactionDate == null || transactionDate.isEmpty()) {
                transactionDate = extractJsonValue(jsonBody, "transaction_date");
            }
        }

        if (idParam == null || idParam.trim().isEmpty() || type == null || title == null || amountParam == null || category == null || transactionDate == null) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().println("{\"error\":\"All fields including transaction ID are required for editing.\"}");
            return;
        }

        int id;
        double amount;
        try {
            id = Integer.parseInt(idParam.trim());
            amount = Double.parseDouble(amountParam.trim());
        } catch (NumberFormatException e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().println("{\"error\":\"Invalid ID or amount format.\"}");
            return;
        }

        String sql = "UPDATE transactions SET type = ?, category = ?, amount = ?, title = ?, transaction_date = ? WHERE id = ?";

        try (
            Connection con = Db.getConnection();
            PreparedStatement ps = con.prepareStatement(sql)
        ) {
            ps.setString(1, type.trim().toLowerCase());
            ps.setString(2, category.trim());
            ps.setDouble(3, amount);
            ps.setString(4, title.trim());
            ps.setDate(5, Date.valueOf(transactionDate.trim()));
            ps.setInt(6, id);

            int rows = ps.executeUpdate();
            response.setContentType("application/json;charset=UTF-8");

            if (rows > 0) {
                response.getWriter().println("{\"success\":true,\"message\":\"Transaction updated successfully in Supabase PostgreSQL.\"}");
            } else {
                response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                response.getWriter().println("{\"error\":\"Transaction ID not found.\"}");
            }

        } catch (SQLException | ClassNotFoundException e) {
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.setContentType("application/json;charset=UTF-8");
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
