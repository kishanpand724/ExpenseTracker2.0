package servlet;

import java.io.IOException;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

/**
 * LogoutServlet invalidates the current Java HttpSession and logs out the user.
 */
@WebServlet(name = "LogoutServlet", urlPatterns = {"/LogoutServlet", "/logout", "/api/auth/logout"})
public class LogoutServlet extends HttpServlet {

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
        handleLogout(request, response);
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        handleLogout(request, response);
    }

    private void handleLogout(HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        setCorsHeaders(request, response);
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }

        boolean isAjax = "XMLHttpRequest".equalsIgnoreCase(request.getHeader("X-Requested-With"))
                || (request.getHeader("Accept") != null && request.getHeader("Accept").contains("application/json"));

        if (!isAjax) {
            response.sendRedirect(request.getContextPath() + "/login.html?logout=true");
            return;
        }

        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().println(
            "{\"success\":true,\"message\":\"Logged out successfully.\","
            + "\"redirect\":\"" + escapeJson(request.getContextPath() + "/login.html?logout=true") + "\"}"
        );
    }

    private String escapeJson(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
