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
 * DailyTrendsServlet retrieves daily income and expense totals
 * strictly isolated for the logged-in user session (WHERE user_id = ?).
 */
@WebServlet(name = "DailyTrendsServlet", urlPatterns = {"/daily-trends", "/view-daily-trends"})
public class DailyTrendsServlet extends HttpServlet {

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

        String sql = "WITH combined_events AS ("
                + "  SELECT TO_CHAR(transaction_date, 'YYYY-MM-DD') as date_str, "
                + "         (CASE WHEN LOWER(type) = 'income' THEN amount ELSE 0 END) as inc, "
                + "         (CASE WHEN LOWER(type) = 'expense' THEN amount ELSE 0 END) as exp "
                + "  FROM transactions "
                + "  WHERE user_id = ? AND transaction_date >= ?::date AND transaction_date <= ?::date "
                + ") "
                + "SELECT date_str, SUM(inc) as total_income, SUM(exp) as total_expense "
                + "FROM combined_events "
                + "GROUP BY date_str "
                + "ORDER BY date_str ASC";

        try (
            Connection con = Db.getConnection();
            PreparedStatement ps = con.prepareStatement(sql)
        ) {
            ps.setInt(1, userId);
            ps.setString(2, startDate);
            ps.setString(3, endDate);

            StringBuilder json = new StringBuilder();
            json.append("{\"startDate\":\"").append(startDate)
                .append("\",\"endDate\":\"").append(endDate)
                .append("\",\"duration\":\"").append(escapeJson(duration))
                .append("\",\"trends\":[");

            try (ResultSet rs = ps.executeQuery()) {
                boolean first = true;
                while (rs.next()) {
                    if (!first) json.append(",");
                    String dateStr = rs.getString("date_str");
                    double income = rs.getDouble("total_income");
                    double expense = rs.getDouble("total_expense");

                    json.append("{")
                        .append("\"date\":\"").append(escapeJson(dateStr)).append("\",")
                        .append("\"income\":").append(income).append(",")
                        .append("\"expense\":").append(expense)
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
