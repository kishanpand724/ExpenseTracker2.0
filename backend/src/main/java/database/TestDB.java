package database;

import java.sql.Connection;

public class TestDB {

    public static void main(String[] args) {

        try {

            Connection con = Db.getConnection();

            System.out.println("Database Connected Successfully!");

            con.close();

        } catch (Exception e) {

            e.printStackTrace();

        }
    }
}
