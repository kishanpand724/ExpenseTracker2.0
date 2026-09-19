package servlet;

import database.Db;
import java.io.IOException;
import java.io.BufferedReader;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Date;
import java.sql.SQLException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

@WebServlet("/api/subscriptions")
public class SubscriptionsServlet extends HttpServlet {

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
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        setCorsHeaders(response);
        response.setContentType("application/json;charset=UTF-8");

        String sql = "SELECT id, name, category, amount, billing_cycle, next_billing, status FROM subscriptions ORDER BY next_billing ASC, id DESC";

        try (
            Connection con = Db.getConnection();
            PreparedStatement ps = con.prepareStatement(sql);
            ResultSet rs = ps.executeQuery()
        ) {
            StringBuilder json = new StringBuilder("[");
            boolean first = true;

            while (rs.next()) {
                if (!first) {
                    json.append(",");
                }

                int id = rs.getInt("id");
                String name = rs.getString("name");
                String category = rs.getString("category");
                double amount = rs.getDouble("amount");
                String billingCycle = rs.getString("billing_cycle");
                String nextBilling = rs.getString("next_billing");
                String status = rs.getString("status");

                json.append("{")
                    .append("\"id\":").append(id).append(",")
                    .append("\"name\":\"").append(escapeJson(name)).append("\",")
                    .append("\"category\":\"").append(escapeJson(category)).append("\",")
                    .append("\"amount\":").append(amount).append(",")
                    .append("\"billingCycle\":\"").append(escapeJson(billingCycle != null ? billingCycle : "Monthly")).append("\",")
                    .append("\"nextBilling\":\"").append(escapeJson(nextBilling != null ? nextBilling : "")).append("\",")
                    .append("\"status\":\"").append(escapeJson(status != null ? status : "Active")).append("\"")
                    .append("}");

                first = false;
            }

            json.append("]");
            response.getWriter().print(json.toString());

        } catch (SQLException | ClassNotFoundException e) {
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().print("{\"error\":\"" + escapeJson(e.getMessage()) + "\"}");
        }
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        setCorsHeaders(response);
        request.setCharacterEncoding("UTF-8");

        String name = request.getParameter("name");
        String category = request.getParameter("category");
        String amountParam = request.getParameter("amount");
        String billingCycle = request.getParameter("billingCycle");
        String nextBilling = request.getParameter("nextBilling");

        // Fallback: Parse JSON body if parameters are empty
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
            category = extractJsonValue(jsonBody, "category");
            amountParam = extractJsonValue(jsonBody, "amount");
            billingCycle = extractJsonValue(jsonBody, "billingCycle");
            nextBilling = extractJsonValue(jsonBody, "nextBilling");
        }

        if (category == null || category.trim().isEmpty()) category = "bills";
        if (billingCycle == null || billingCycle.trim().isEmpty()) billingCycle = "Monthly";

        if (name == null || name.trim().isEmpty() || amountParam == null || amountParam.trim().isEmpty()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().println("{\"error\":\"Subscription name and amount are required.\"}");
            return;
        }

        double amount;
        try {
            amount = Double.parseDouble(amountParam);
        } catch (NumberFormatException e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().println("{\"error\":\"Invalid amount.\"}");
            return;
        }

        if (nextBilling == null || nextBilling.trim().isEmpty()) {
            nextBilling = new Date(System.currentTimeMillis()).toString();
        }

        String sql = "INSERT INTO subscriptions (name, category, amount, billing_cycle, next_billing, status) VALUES (?, ?, ?, ?, ?, 'Active')";

        try (
            Connection con = Db.getConnection();
            PreparedStatement ps = con.prepareStatement(sql)
        ) {
            ps.setString(1, name.trim());
            ps.setString(2, category.trim());
            ps.setDouble(3, amount);
            ps.setString(4, billingCycle.trim());
            ps.setDate(5, Date.valueOf(nextBilling.trim()));

            ps.executeUpdate();

            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().println("{\"success\":true,\"message\":\"Subscription added to Supabase PostgreSQL.\"}");

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
