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

@WebServlet("/delete-transaction")
public class DeleteTransactionServlet extends HttpServlet {

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
    protected void doPost(HttpServletRequest request,
                           HttpServletResponse response)
            throws ServletException, IOException {

        setCorsHeaders(response);
        String idParam = request.getParameter("id");
        String titleParam = request.getParameter("title");

        if ((idParam == null || idParam.trim().isEmpty()) && (titleParam == null || titleParam.trim().isEmpty())) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().println("{\"error\":\"Transaction identifier is required\"}");
            return;
        }

        boolean useId = idParam != null && !idParam.trim().isEmpty();
        String sql = useId ? "DELETE FROM transactions WHERE id = ?" : "DELETE FROM transactions WHERE title = ?";

        try (
            Connection con = Db.getConnection();
            PreparedStatement ps = con.prepareStatement(sql)
        ) {
            if (useId) {
                try {
                    ps.setInt(1, Integer.parseInt(idParam));
                } catch (NumberFormatException e) {
                    ps.setString(1, idParam);
                }
            } else {
                ps.setString(1, titleParam);
            }

            int rows = ps.executeUpdate();
            response.setContentType("application/json;charset=UTF-8");

            if (rows > 0) {
                response.getWriter().println("{\"success\":true,\"message\":\"Transaction deleted successfully.\"}");
            } else {
                response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                response.getWriter().println("{\"error\":\"Transaction not found\"}");
            }

        } catch (SQLException | ClassNotFoundException e) {
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().println("{\"error\":\"Database error: " + escapeJson(e.getMessage()) + "\"}");
        }
    }

    private String escapeJson(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}

