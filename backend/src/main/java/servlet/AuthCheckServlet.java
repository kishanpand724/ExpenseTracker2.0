package servlet;

import java.io.IOException;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

/**
 * AuthCheckServlet checks the active Java HttpSession to return the
 * current authenticated user's session status.
 */
@WebServlet(name = "AuthCheckServlet", urlPatterns = {"/AuthCheckServlet", "/api/auth/me", "/session-check", "/auth-check"})
public class AuthCheckServlet extends HttpServlet {

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
        processCheck(request, response);
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        processCheck(request, response);
    }

    private void processCheck(HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        setCorsHeaders(request, response);
        response.setContentType("application/json;charset=UTF-8");
        response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        response.setHeader("Pragma", "no-cache");
        response.setDateHeader("Expires", 0);

        HttpSession session = request.getSession(false);
        if (session != null && session.getAttribute("user_id") != null) {
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

            if (userId > 0) {
                String userName = (String) session.getAttribute("user_name");
                String userEmail = (String) session.getAttribute("user_email");

                response.getWriter().println(
                    "{\"authenticated\":true,\"user_id\":" + userId + ",\"user\":{"
                    + "\"id\":" + userId + ","
                    + "\"name\":\"" + escapeJson(userName != null ? userName : "User") + "\","
                    + "\"email\":\"" + escapeJson(userEmail != null ? userEmail : "") + "\""
                    + "}}"
                );
                return;
            }
        }

        response.getWriter().println("{\"authenticated\":false}");
    }

    private String escapeJson(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
