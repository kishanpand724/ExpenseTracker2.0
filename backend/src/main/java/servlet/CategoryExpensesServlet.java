package servlet;

import database.Db;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

/**
 * CategoryExpensesServlet retrieves breakdown of expenses grouped by category
 * strictly isolated for the logged-in user session (WHERE user_id = ?).
 */
@WebServlet(name = "CategoryExpensesServlet", urlPatterns = {"/category-expenses", "/view-category-expenses"})
public class CategoryExpensesServlet extends HttpServlet {

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

        setCorsHeaders(request, response);
        response.setContentType("application/json;charset=UTF-8");
        response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

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

        String duration = request.getParameter("duration");
        if (duration == null || duration.trim().isEmpty()) {
            duration = "this_month";
        }

        String startDate = request.getParameter("start_date");
        String endDate = request.getParameter("end_date");

        LocalDate now = LocalDate.now();
        int year = now.getYear();
        int month = now.getMonthValue();

        if (startDate == null || endDate == null || startDate.isEmpty() || endDate.isEmpty() || !"custom".equals(duration)) {
            if ("this_month".equals(duration)) {
                startDate = LocalDate.of(year, month, 1).toString();
                endDate = LocalDate.of(year, month, now.lengthOfMonth()).toString();
            } else if ("last_month".equals(duration)) {
                LocalDate lastMonth = now.minusMonths(1);
                startDate = LocalDate.of(lastMonth.getYear(), lastMonth.getMonthValue(), 1).toString();
                endDate = LocalDate.of(lastMonth.getYear(), lastMonth.getMonthValue(), lastMonth.lengthOfMonth()).toString();
            } else if ("last_3_months".equals(duration)) {
                LocalDate threeMonthsAgo = now.minusMonths(2);
                startDate = LocalDate.of(threeMonthsAgo.getYear(), threeMonthsAgo.getMonthValue(), 1).toString();
                endDate = LocalDate.of(year, month, now.lengthOfMonth()).toString();
            } else if ("last_6_months".equals(duration)) {
                LocalDate sixMonthsAgo = now.minusMonths(5);
                startDate = LocalDate.of(sixMonthsAgo.getYear(), sixMonthsAgo.getMonthValue(), 1).toString();
                endDate = LocalDate.of(year, month, now.lengthOfMonth()).toString();
            } else if ("this_year".equals(duration)) {
                startDate = year + "-01-01";
                endDate = year + "-12-31";
            }
        }

        if (startDate == null || endDate == null) {
            startDate = LocalDate.of(year, month, 1).toString();
            endDate = LocalDate.of(year, month, now.lengthOfMonth()).toString();
        }

        String sql = "WITH combined_expenses AS ("
                + "  SELECT LOWER(category) as category, amount "
                + "  FROM transactions "
                + "  WHERE LOWER(type) = 'expense' AND user_id = ? AND transaction_date >= ?::date AND transaction_date <= ?::date "
                + "  UNION ALL "
                + "  SELECT LOWER(category) as category, amount "
                + "  FROM subscriptions "
                + "  WHERE LOWER(status) = 'active' AND user_id = ? AND next_billing >= ?::date AND next_billing <= ?::date "
                + ") "
                + "SELECT category, SUM(amount) as total_amount "
                + "FROM combined_expenses "
                + "GROUP BY category "
                + "ORDER BY total_amount DESC";

        try (
            Connection con = Db.getConnection();
            PreparedStatement ps = con.prepareStatement(sql)
        ) {
            ps.setInt(1, userId);
            ps.setString(2, startDate);
            ps.setString(3, endDate);
            ps.setInt(4, userId);
            ps.setString(5, startDate);
            ps.setString(6, endDate);

            StringBuilder json = new StringBuilder();
            json.append("{\"startDate\":\"").append(startDate)
                .append("\",\"endDate\":\"").append(endDate)
                .append("\",\"duration\":\"").append(escapeJson(duration))
                .append("\",\"categories\":[");

            try (ResultSet rs = ps.executeQuery()) {
                boolean first = true;
                while (rs.next()) {
                    if (!first) json.append(",");
                    String cat = rs.getString("category");
                    if (cat == null) cat = "others";
                    cat = cat.toLowerCase().trim();
                    if ("other".equals(cat)) cat = "others";

                    double totalAmount = rs.getDouble("total_amount");
                    String label = cat.substring(0, 1).toUpperCase() + cat.substring(1);

                    json.append("{")
                        .append("\"category\":\"").append(escapeJson(cat)).append("\",")
                        .append("\"label\":\"").append(escapeJson(label)).append("\",")
                        .append("\"totalAmount\":").append(totalAmount).append(",")
                        .append("\"value\":").append(totalAmount)
                        .append("}");

                    first = false;
                }
            }

            json.append("]}");
            response.getWriter().print(json.toString());

        } catch (SQLException | ClassNotFoundException e) {
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().print("{\"error\":\"Database error: " + escapeJson(e.getMessage()) + "\"}");
        }
    }

    private String escapeJson(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
