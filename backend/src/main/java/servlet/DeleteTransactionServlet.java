package servlet;

import database.Db;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

/**
 * DeleteTransactionServlet deletes a transaction using WHERE id = ? AND user_id = ?
 * to guarantee strict user data isolation.
 */
@WebServlet("/delete-transaction")
public class DeleteTransactionServlet extends HttpServlet {

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

        String idParam = request.getParameter("id");
        String titleParam = request.getParameter("title");

        if ((idParam == null || idParam.trim().isEmpty()) && (titleParam == null || titleParam.trim().isEmpty())) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().println("{\"error\":\"Transaction identifier is required\"}");
            return;
        }

        boolean useId = idParam != null && !idParam.trim().isEmpty();
        String sql = useId ? "DELETE FROM transactions WHERE id = ? AND user_id = ?" : "DELETE FROM transactions WHERE title = ? AND user_id = ?";

        try (
            Connection con = Db.getConnection();
            PreparedStatement ps = con.prepareStatement(sql)
        ) {
            if (useId) {
                try {
                    ps.setInt(1, Integer.parseInt(idParam.trim()));
                } catch (NumberFormatException e) {
                    ps.setString(1, idParam.trim());
                }
            } else {
                ps.setString(1, titleParam.trim());
            }
            ps.setInt(2, userId);

            int rows = ps.executeUpdate();

            if (rows > 0) {
                response.getWriter().println("{\"success\":true,\"message\":\"Transaction deleted successfully.\"}");
            } else {
                response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                response.getWriter().println("{\"error\":\"Transaction not found or unauthorized\"}");
            }

        } catch (SQLException | ClassNotFoundException e) {
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().println("{\"error\":\"Database error: " + escapeJson(e.getMessage()) + "\"}");
        }
    }

    private String escapeJson(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
