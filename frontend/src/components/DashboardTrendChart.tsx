import React, { useState, useEffect, useCallback } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Grid,
  ChartTooltip,
  Legend,
} from "../bklitui/charts";
import { getApiUrl, getAuthHeaders } from "../config/api";

interface TrendDataPoint {
  label: string;
  income: number;
  expense: number;
}

export const DashboardTrendChart: React.FC = () => {
  const [data, setData] = useState<TrendDataPoint[]>([]);
  const [duration, setDuration] = useState<string>("this_month");
  const [loading, setLoading] = useState<boolean>(true);

  const computeFromClientTransactions = useCallback(() => {
    const rawTxs = (window as any).allTransactionsData;
    if (!Array.isArray(rawTxs) || rawTxs.length === 0) {
      return [];
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const dateBuckets: { [key: string]: { income: number; expense: number } } = {};

    rawTxs.forEach((tx) => {
      const dStr = tx.date || tx.transaction_date;
      if (!dStr) return;
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return;

      if (duration === "this_month") {
        if (d.getMonth() !== currentMonth || d.getFullYear() !== currentYear) return;
      }

      const key = `${d.getDate()} ${d.toLocaleString("default", { month: "short" })}`;
      if (!dateBuckets[key]) {
        dateBuckets[key] = { income: 0, expense: 0 };
      }

      const amt = Number(tx.amount || 0);
      if (String(tx.type).toLowerCase() === "income") {
        dateBuckets[key].income += amt;
      } else if (String(tx.type).toLowerCase() === "expense") {
        dateBuckets[key].expense += amt;
      }
    });

    const points: TrendDataPoint[] = Object.keys(dateBuckets).map((k) => ({
      label: k,
      income: dateBuckets[k].income,
      expense: dateBuckets[k].expense,
    }));

    return points;
  }, [duration]);

  const fetchTrendData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ duration });

      const response = await fetch(getApiUrl(`daily-trends?${params.toString()}`), {
        credentials: "include",
        headers: getAuthHeaders({ Accept: "application/json" }),
      });

      if (!response.ok) {
        const fallback = computeFromClientTransactions();
        setData(fallback);
        setLoading(false);
        return;
      }

      const resData = await response.json();
      if (Array.isArray(resData.dailyTrends) && resData.dailyTrends.length > 0) {
        const points: TrendDataPoint[] = resData.dailyTrends.map((item: any) => ({
          label: item.formattedDate || item.rawDate,
          income: Number(item.income || 0),
          expense: Number(item.expense || 0),
        }));
        setData(points);
      } else {
        const fallback = computeFromClientTransactions();
        setData(fallback);
      }
    } catch {
      const fallback = computeFromClientTransactions();
      setData(fallback);
    } finally {
      setLoading(false);
    }
  }, [duration, computeFromClientTransactions]);

  useEffect(() => {
    fetchTrendData();

    (window as any).refreshDashboardTrendChart = fetchTrendData;

    const handleUpdate = () => {
      fetchTrendData();
    };

    window.addEventListener("transactionsUpdated", handleUpdate);
    return () => {
      window.removeEventListener("transactionsUpdated", handleUpdate);
    };
  }, [fetchTrendData]);

  const totalIncome = data.reduce((s, p) => s + p.income, 0);
  const totalExpense = data.reduce((s, p) => s + p.expense, 0);

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Duration selector header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", gap: "1rem", fontSize: "0.8rem", color: "#64748b" }}>
          <span>
            Income: <strong style={{ color: "#10b981" }}>₹{Math.round(totalIncome).toLocaleString("en-IN")}</strong>
          </span>
          <span>
            Expense: <strong style={{ color: "#ef4444" }}>₹{Math.round(totalExpense).toLocaleString("en-IN")}</strong>
          </span>
        </div>
        <select
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          style={{
            padding: "0.35rem 0.65rem",
            fontSize: "0.8rem",
            borderRadius: "0px",
            border: "1px solid #cbd5e1",
            backgroundColor: "#ffffff",
            color: "#1e293b",
            fontWeight: 600,
            cursor: "pointer",
            outline: "none",
          }}
        >
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="last_3_months">Last 3 Months</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {loading && data.length === 0 ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "#64748b", fontSize: "0.85rem" }}>
          Loading trend chart...
        </div>
      ) : data.length === 0 ? (
        <div style={{ padding: "3rem 1rem", textAlign: "center", width: "100%" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "0px", backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 0.75rem auto" }}>
            <svg style={{ width: "22px", height: "22px", color: "#94a3b8" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <p style={{ color: "#334155", fontWeight: 700, fontSize: "0.875rem", margin: "0 0 0.25rem 0" }}>
            No trend records for this period
          </p>
          <span style={{ fontSize: "0.775rem", color: "#94a3b8" }}>
            Record income and expenses to view the cash flow trend.
          </span>
        </div>
      ) : (
        <div style={{ width: "100%", height: "260px", minHeight: "260px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <Grid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickFormatter={(v) => (v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`)}
              />
              <ChartTooltip
                formatter={(value: any, name: any) => [`₹${Number(value).toLocaleString("en-IN")}`, name]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: "8px", fontSize: "0.775rem" }} />
              <Bar dataKey="income" name="Income" fill="#10b981" radius={0} />
              <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={0} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default DashboardTrendChart;
