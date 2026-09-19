package servlet;

import database.Db;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

@WebServlet("/view-transactions")
public class ViewTransactionsServlet extends HttpServlet {

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
    protected void doGet(HttpServletRequest request,
                          HttpServletResponse response)
            throws ServletException, IOException {

        setCorsHeaders(response);
        response.setContentType("application/json;charset=UTF-8");

        String sql = "SELECT * FROM transactions ORDER BY transaction_date DESC, id DESC";

        try (
            Connection con = Db.getConnection();
            PreparedStatement ps = con.prepareStatement(sql);
            ResultSet rs = ps.executeQuery()
        ) {
            ResultSetMetaData metaData = rs.getMetaData();
            boolean hasIdColumn = false;
            int colCount = metaData.getColumnCount();
            for (int i = 1; i <= colCount; i++) {
                if ("id".equalsIgnoreCase(metaData.getColumnName(i))) {
                    hasIdColumn = true;
                    break;
                }
            }

            StringBuilder json = new StringBuilder();
            json.append("[");

            boolean first = true;
            int generatedId = 1;

            while (rs.next()) {

                if (!first) {
                    json.append(",");
                }

                String type = rs.getString("type");
                String category = rs.getString("category");
                double amount = rs.getDouble("amount");
                String title = rs.getString("title");
                String date = rs.getString("transaction_date");

                json.append("{");

                if (hasIdColumn) {
                    int id = rs.getInt("id");
                    json.append("\"id\":").append(id).append(",");
                } else {
                    json.append("\"id\":").append(generatedId++).append(",");
                }

                json.append("\"type\":\"").append(escapeJson(type)).append("\",");
                json.append("\"category\":\"").append(escapeJson(category)).append("\",");
                json.append("\"amount\":").append(amount).append(",");
                json.append("\"title\":\"").append(escapeJson(title)).append("\",");
                json.append("\"date\":\"").append(escapeJson(date != null ? date : "")).append("\",");
                json.append("\"transaction_date\":\"").append(escapeJson(date != null ? date : "")).append("\"");

                json.append("}");

                first = false;
            }

            json.append("]");

            response.getWriter().print(json.toString());

        } catch (SQLException | ClassNotFoundException e) {

            e.printStackTrace();

            response.setStatus(
                    HttpServletResponse.SC_INTERNAL_SERVER_ERROR
            );

            response.getWriter().print(
                    "{\"error\":\""
                    + escapeJson(e.getMessage())
                    + "\"}"
            );
        }
    }

    private String escapeJson(String value) {

        if (value == null) {
            return "";
        }

        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"");
    }
}

