import React, { useState, useEffect, useCallback } from "react";
import { PieChart, PieSlice, PieCenter, PieChartItem } from "@bklitui/ui/charts";

interface CategorySummary {
  category: string;
  label: string;
  totalAmount: number;
  value: number;
}

interface ApiResponse {
  startDate: string;
  endDate: string;
  duration: string;
  categories: CategorySummary[];
}

const CATEGORY_COLORS: { [key: string]: string } = {
  food: "#f59e0b",
  travel: "#3b82f6",
  shopping: "#ec4899",
  bills: "#ef4444",
  entertainment: "#8b5cf6",
  education: "#10b981",
  fitness: "#06b6d4",
  software: "#6366f1",
  others: "#64748b",
};

export const DashboardExpensePieChart: React.FC = () => {
  const [duration, setDuration] = useState<string>("this_month");

  // Custom date range state
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const firstDayStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

  const [startDate, setStartDate] = useState<string>(firstDayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  const [pieData, setPieData] = useState<PieChartItem[]>([]);
  const [totalExpense, setTotalExpense] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchCategoryExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ duration });
      if (duration === "custom") {
        if (startDate) params.append("start_date", startDate);
        if (endDate) params.append("end_date", endDate);
      }

      const response = await fetch(`/category-expenses?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch category expenses (Status: ${response.status})`);
      }

      const data: ApiResponse = await response.json();
      const rawCategories = data.categories || [];

      if (!Array.isArray(rawCategories) || rawCategories.length === 0) {
        setPieData([]);
        setTotalExpense(0);
        setLoading(false);
        return;
      }

      let sum = 0;
      const formattedData: PieChartItem[] = rawCategories.map((item) => {
        const catKey = String(item.category || "others").toLowerCase().trim();
        const val = Number(item.totalAmount || item.value) || 0;
        sum += val;
        return {
          label: item.label || catKey.charAt(0).toUpperCase() + catKey.slice(1),
          value: val,
          color: CATEGORY_COLORS[catKey] || CATEGORY_COLORS.others,
        };
      });

      setPieData(formattedData);
      setTotalExpense(sum);
    } catch (err) {
      console.error("Error fetching category expenses:", err);
      setPieData([]);
      setTotalExpense(0);
    } finally {
      setLoading(false);
    }
  }, [duration, startDate, endDate]);

  useEffect(() => {
    fetchCategoryExpenses();

    (window as any).refreshDashboardPieChart = fetchCategoryExpenses;

    const handleUpdate = () => {
      fetchCategoryExpenses();
    };

    window.addEventListener("transactionsUpdated", handleUpdate);
    return () => {
      window.removeEventListener("transactionsUpdated", handleUpdate);
      if ((window as any).refreshDashboardPieChart === fetchCategoryExpenses) {
        delete (window as any).refreshDashboardPieChart;
      }
    };
  }, [fetchCategoryExpenses]);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: "1rem" }}>
      
      {/* Compact Duration Filter Header */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b" }}>Duration:</span>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            style={{
              padding: "0.35rem 0.65rem",
              fontSize: "0.8rem",
              borderRadius: "0.375rem",
              border: "1px solid #cbd5e1",
              backgroundColor: "#ffffff",
              color: "#1e293b",
              fontWeight: 600,
              cursor: "pointer",
              outline: "none",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
            }}
          >
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="last_3_months">Last 3 Months</option>
            <option value="last_6_months">Last 6 Months</option>
            <option value="this_year">This Year</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {/* Custom Date Range Pickers */}
        {duration === "custom" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap", backgroundColor: "#f8fafc", padding: "0.5rem 0.65rem", borderRadius: "0.375rem", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.775rem", color: "#475569" }}>
              <span style={{ fontWeight: 600 }}>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ padding: "0.25rem 0.4rem", fontSize: "0.775rem", borderRadius: "0.25rem", border: "1px solid #cbd5e1", outline: "none" }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.775rem", color: "#475569" }}>
              <span style={{ fontWeight: 600 }}>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ padding: "0.25rem 0.4rem", fontSize: "0.775rem", borderRadius: "0.25rem", border: "1px solid #cbd5e1", outline: "none" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Pie Chart Content / Empty State */}
      {loading && pieData.length === 0 ? (
        <div style={{ padding: "2.5rem", textAlign: "center", color: "#64748b", fontSize: "0.85rem" }}>
          Loading category expenses...
        </div>
      ) : pieData.length === 0 ? (
        <div style={{ padding: "2.5rem 1rem", textAlign: "center", width: "100%" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 0.75rem auto" }}>
            <svg style={{ width: "24px", height: "24px", color: "#94a3b8" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
          </div>
          <p style={{ color: "#334155", fontWeight: 700, fontSize: "0.9rem", margin: "0 0 0.25rem 0" }}>
            No expenses found for this period
          </p>
          <span style={{ fontSize: "0.775rem", color: "#94a3b8" }}>
            Try selecting a different date range filter.
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", gap: "1.25rem" }}>
          <PieChart data={pieData} innerRadius={60} size={200}>
            {pieData.map((item, index) => (
              <PieSlice index={index} key={item.label} color={item.color} />
            ))}
            <PieCenter defaultLabel="Total" />
          </PieChart>

          {/* Category Breakdown Legend */}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.4rem 0.85rem", fontSize: "0.775rem", width: "100%" }}>
            {pieData.map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: item.color, display: "inline-block" }}></span>
                <span style={{ color: "#334155", fontWeight: 600 }}>{item.label}:</span>
                <span style={{ color: "#0f172a", fontWeight: 700 }}>₹{item.value.toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default DashboardExpensePieChart;
