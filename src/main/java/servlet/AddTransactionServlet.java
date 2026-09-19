package servlet;

import database.Db;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.Date;
import java.sql.SQLException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

@WebServlet("/add-transaction")
public class AddTransactionServlet extends HttpServlet {

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

        String type = request.getParameter("type");
        String title = request.getParameter("title");
        String amountParam = request.getParameter("amount");
        String category = request.getParameter("category");
        String transactionDate = request.getParameter("transaction_date");

        if (transactionDate == null || transactionDate.trim().isEmpty()) {
            transactionDate = request.getParameter("date");
        }

        System.out.println("========== ADD TRANSACTION TO SUPABASE ==========");
        System.out.println("TYPE     = " + type);
        System.out.println("TITLE    = " + title);
        System.out.println("AMOUNT   = " + amountParam);
        System.out.println("CATEGORY = " + category);
        System.out.println("DATE     = " + transactionDate);
        System.out.println("==================================================");

        if (type == null || title == null || amountParam == null
                || category == null || transactionDate == null
                || type.trim().isEmpty()
                || title.trim().isEmpty()
                || amountParam.trim().isEmpty()
                || category.trim().isEmpty()
                || transactionDate.trim().isEmpty()) {

            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().println("{\"error\":\"Please fill all fields.\"}");
            return;
        }

        double amount;
        try {
            amount = Double.parseDouble(amountParam);
        } catch (NumberFormatException e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().println("{\"error\":\"Invalid numeric amount.\"}");
            return;
        }

        String sql = "INSERT INTO transactions "
                + "(type, category, amount, title, transaction_date) "
                + "VALUES (?, ?, ?, ?, ?)";

        try (
            Connection con = Db.getConnection();
            PreparedStatement ps = con.prepareStatement(sql)
        ) {
            ps.setString(1, type.trim().toLowerCase());
            ps.setString(2, category);
            ps.setDouble(3, amount);
            ps.setString(4, title);
            ps.setDate(5, Date.valueOf(transactionDate));

            int rows = ps.executeUpdate();

            System.out.println("ROWS INSERTED INTO SUPABASE = " + rows);

            response.setContentType("application/json;charset=UTF-8");
            String acceptHeader = request.getHeader("Accept");
            if (acceptHeader != null && acceptHeader.contains("application/json")) {
                response.getWriter().println("{\"success\":true,\"message\":\"Transaction saved to Supabase PostgreSQL.\"}");
            } else {
                response.sendRedirect("index.html");
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

