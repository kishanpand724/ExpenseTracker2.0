import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Grid,
  ChartTooltip,
  Legend,
} from "@bklitui/ui/charts";

interface Transaction {
  id: number;
  type: string;
  category: string;
  amount: number;
  title: string;
  date: string;
}

interface DailyChartDataItem {
  rawDate: string;
  formattedDate: string;
  income: number;
  expense: number;
}

interface CategorySummary {
  category: string;
  formattedCategory: string;
  amount: number;
  percentage: number;
  color: string;
}

interface MonthlySummary {
  monthKey: string;
  formattedMonth: string;
  income: number;
  expense: number;
  net: number;
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

export const BklitAnalyticsChart: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Derived Analytics State
  const [dailyChartData, setDailyChartData] = useState<DailyChartDataItem[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategorySummary[]>([]);
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>([]);
  const [totalIncome, setTotalIncome] = useState<number>(0);
  const [totalExpense, setTotalExpense] = useState<number>(0);
  const [avgExpense, setAvgExpense] = useState<number>(0);
  const [highestExpenseTx, setHighestExpenseTx] = useState<Transaction | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/view-transactions", {
        headers: { "Accept": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch transactions (Status: ${response.status})`);
      }

      const rawData: Transaction[] = await response.json();

      if (!Array.isArray(rawData) || rawData.length === 0) {
        setTransactions([]);
        setDailyChartData([]);
        setCategoryBreakdown([]);
        setMonthlySummaries([]);
        setTotalIncome(0);
        setTotalExpense(0);
        setAvgExpense(0);
        setHighestExpenseTx(null);
        setLoading(false);
        return;
      }

      setTransactions(rawData);

      let sumIncome = 0;
      let sumExpense = 0;
      let expenseCount = 0;
      let maxExpTx: Transaction | null = null;

      const mapByDate: { [dateKey: string]: { income: number; expense: number } } = {};
      const mapByCategory: { [cat: string]: number } = {};
      const mapByMonth: { [monthKey: string]: { income: number; expense: number } } = {};

      rawData.forEach((tx) => {
        const amt = Number(tx.amount) || 0;
        const type = String(tx.type || "").toLowerCase().trim();
        let cat = String(tx.category || "others").toLowerCase().trim();
        if (cat === "other") cat = "others";

        let dateStr = tx.date || (tx as any).transaction_date || "";
        if (dateStr.includes("T")) dateStr = dateStr.split("T")[0];

        // 1. Total Income & Expense
        if (type === "income") {
          sumIncome += amt;
        } else if (type === "expense") {
          sumExpense += amt;
          expenseCount++;
          mapByCategory[cat] = (mapByCategory[cat] || 0) + amt;

          if (!maxExpTx || amt > Number(maxExpTx.amount || 0)) {
            maxExpTx = tx;
          }
        }

        // 2. Group by Date for Chart
        if (dateStr) {
          if (!mapByDate[dateStr]) mapByDate[dateStr] = { income: 0, expense: 0 };
          if (type === "income") mapByDate[dateStr].income += amt;
          if (type === "expense") mapByDate[dateStr].expense += amt;

          // 3. Group by Month (YYYY-MM)
          const monthKey = dateStr.substring(0, 7);
          if (monthKey && monthKey.length === 7) {
            if (!mapByMonth[monthKey]) mapByMonth[monthKey] = { income: 0, expense: 0 };
            if (type === "income") mapByMonth[monthKey].income += amt;
            if (type === "expense") mapByMonth[monthKey].expense += amt;
          }
        }
      });

      setTotalIncome(sumIncome);
      setTotalExpense(sumExpense);
      setAvgExpense(expenseCount > 0 ? sumExpense / expenseCount : 0);
      setHighestExpenseTx(maxExpTx);

      // Process Chart Items
      const sortedDates = Object.keys(mapByDate).sort(
        (a, b) => new Date(a).getTime() - new Date(b).getTime()
      );

      const chartItems: DailyChartDataItem[] = sortedDates.map((dStr) => {
        const d = new Date(dStr + "T00:00:00");
        const formattedDate = isNaN(d.getTime())
          ? dStr
          : d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });

        return {
          rawDate: dStr,
          formattedDate,
          income: mapByDate[dStr].income,
          expense: mapByDate[dStr].expense,
        };
      });
      setDailyChartData(chartItems);

      // Process Category Breakdown
      const catList: CategorySummary[] = Object.keys(mapByCategory)
        .sort((a, b) => mapByCategory[b] - mapByCategory[a])
        .map((catKey) => {
          const amt = mapByCategory[catKey];
          const pct = sumExpense > 0 ? Math.round((amt / sumExpense) * 100) : 0;
          return {
            category: catKey,
            formattedCategory: catKey.charAt(0).toUpperCase() + catKey.slice(1),
            amount: amt,
            percentage: pct,
            color: CATEGORY_COLORS[catKey] || CATEGORY_COLORS.others,
          };
        });
      setCategoryBreakdown(catList);

      // Process Monthly Summaries
      const sortedMonths = Object.keys(mapByMonth).sort().reverse();
      const monthlyList: MonthlySummary[] = sortedMonths.map((mKey) => {
        const parts = mKey.split("-");
        const year = parts[0];
        const monthNum = parseInt(parts[1], 10) - 1;
        const d = new Date(Number(year), monthNum, 1);
        const formattedMonth = isNaN(d.getTime())
          ? mKey
          : d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

        const inc = mapByMonth[mKey].income;
        const exp = mapByMonth[mKey].expense;

        return {
          monthKey: mKey,
          formattedMonth,
          income: inc,
          expense: exp,
          net: inc - exp,
        };
      });
      setMonthlySummaries(monthlyList);

    } catch (err: any) {
      console.error("Error fetching transactions for Analytics:", err);
      setError(err.message || "Failed to load records");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();

    (window as any).refreshAnalyticsChart = fetchTransactions;

    const handleUpdate = () => {
      fetchTransactions();
    };

    window.addEventListener("transactionsUpdated", handleUpdate);
    return () => {
      window.removeEventListener("transactionsUpdated", handleUpdate);
      if ((window as any).refreshAnalyticsChart === fetchTransactions) {
        delete (window as any).refreshAnalyticsChart;
      }
    };
  }, [fetchTransactions]);

  const formatCurrency = (val: number) => {
    return "₹" + Number(val || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const netBalance = totalIncome - totalExpense;
  const topCategory = categoryBreakdown[0] || null;
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0;

  if (loading && transactions.length === 0) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", backgroundColor: "#ffffff", borderRadius: "0.75rem", border: "1px solid #e2e8f0" }}>
        <p style={{ color: "#64748b", fontSize: "0.9rem" }}>Loading financial data...</p>
      </div>
    );
  }

  if (error && transactions.length === 0) {
    return (
      <div style={{ padding: "2.5rem", textAlign: "center", backgroundColor: "#fef2f2", borderRadius: "0.75rem", border: "1px solid #fecaca" }}>
        <p style={{ color: "#ef4444", fontWeight: 600, fontSize: "0.9rem" }}>{error}</p>
        <button
          onClick={fetchTransactions}
          style={{ marginTop: "0.75rem", padding: "0.4rem 0.85rem", backgroundColor: "#ef4444", color: "#ffffff", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.8rem", fontWeight: 500 }}
        >
          Retry Loading
        </button>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div style={{ padding: "3.5rem 1.5rem", textAlign: "center", backgroundColor: "#ffffff", borderRadius: "0.75rem", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ width: "56px", height: "56px", borderRadius: "50%", backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem auto" }}>
          <svg style={{ width: "28px", height: "28px", color: "#94a3b8" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1e293b", margin: "0 0 0.35rem 0" }}>No transaction data available</h3>
        <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 1.25rem 0", maxWidth: "400px", marginLeft: "auto", marginRight: "auto" }}>
          Add your income or expense transactions in the tracker to view real-time analytics and financial trends.
        </p>
        <button
          onClick={fetchTransactions}
          style={{ padding: "0.45rem 1rem", backgroundColor: "#2563eb", color: "#ffffff", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}
        >
          Refresh Page
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", width: "100%" }}>

      {/* 1. TOP SUMMARY CARDS (SPENDING OVERVIEW) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        
        {/* Total Income Card */}
        <div style={{ backgroundColor: "#ffffff", padding: "1.25rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.025em" }}>Total Income</span>
            <span style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981", fontSize: "0.85rem" }}>↓</span>
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#059669" }}>{formatCurrency(totalIncome)}</div>
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.35rem" }}>Total income recorded</div>
        </div>

        {/* Total Expenses Card */}
        <div style={{ backgroundColor: "#ffffff", padding: "1.25rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.025em" }}>Total Expenses</span>
            <span style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", fontSize: "0.85rem" }}>↑</span>
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#dc2626" }}>{formatCurrency(totalExpense)}</div>
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.35rem" }}>Total outflow tracked</div>
        </div>

        {/* Net Balance / Savings Card */}
        <div style={{ backgroundColor: "#ffffff", padding: "1.25rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.025em" }}>Savings / Remaining Balance</span>
            <span style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: netBalance >= 0 ? "#e0f2fe" : "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", color: netBalance >= 0 ? "#0284c7" : "#ef4444", fontSize: "0.85rem" }}>💰</span>
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: netBalance >= 0 ? "#0284c7" : "#dc2626" }}>{formatCurrency(netBalance)}</div>
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.35rem" }}>Income minus Expenses</div>
        </div>

        {/* Average Expense Card */}
        <div style={{ backgroundColor: "#ffffff", padding: "1.25rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.025em" }}>Average Expense</span>
            <span style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", color: "#d97706", fontSize: "0.85rem" }}>📊</span>
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#d97706" }}>{formatCurrency(avgExpense)}</div>
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.35rem" }}>Per expense transaction</div>
        </div>

      </div>

      {/* 2. MAIN CHART: INCOME VS EXPENSE TREND (Bklit UI LineChart) */}
      <div style={{ backgroundColor: "#ffffff", padding: "1.5rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
              Income vs Expenses
            </h3>
            <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem", margin: 0 }}>
              Real-time cash flow comparison over time
            </p>
          </div>
          <button
            onClick={fetchTransactions}
            title="Refresh data"
            style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "0.375rem", padding: "0.35rem 0.75rem", fontSize: "0.775rem", color: "#334155", cursor: "pointer", fontWeight: 600 }}
          >
            ↻ Sync
          </button>
        </div>

        <div style={{ width: "100%", height: "320px", minHeight: "320px" }}>
          <LineChart data={dailyChartData} height={300} responsive={true}>
            <Grid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="formattedDate" stroke="#64748b" tick={{ fontSize: 11, fill: "#64748b" }} />
            <YAxis
              stroke="#64748b"
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickFormatter={(val) => (val >= 1000 ? `₹${(val / 1000).toFixed(0)}k` : `₹${val}`)}
            />
            <ChartTooltip
              formatter={(value: any, name: any) => [formatCurrency(Number(value) || 0), name]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: "12px", fontSize: "0.8rem" }} />
            <Line
              type="natural"
              dataKey="income"
              name="Income"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#10b981" }}
              activeDot={{ r: 6 }}
              isAnimationActive={true}
            />
            <Line
              type="natural"
              dataKey="expense"
              name="Expense"
              stroke="#ef4444"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#ef4444" }}
              activeDot={{ r: 6 }}
              isAnimationActive={true}
            />
          </LineChart>
        </div>
      </div>

      {/* 3. CATEGORY-WISE SPENDING SECTION */}
      <div style={{ backgroundColor: "#ffffff", padding: "1.5rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.25rem 0" }}>Category-wise Spending</h3>
        <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 1.25rem 0" }}>
          Distribution of actual expenses logged across spending categories
        </p>

        {categoryBreakdown.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "#94a3b8", fontStyle: "italic", margin: 0 }}>No expense category records available.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {categoryBreakdown.map((catItem) => (
              <div key={catItem.category}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.875rem", marginBottom: "0.35rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: catItem.color, display: "inline-block" }}></span>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>{catItem.formattedCategory}</span>
                  </div>
                  <span style={{ fontWeight: 700, color: "#334155" }}>
                    {formatCurrency(catItem.amount)} <span style={{ color: "#64748b", fontWeight: 500, fontSize: "0.8rem" }}>({catItem.percentage}%)</span>
                  </span>
                </div>
                <div style={{ width: "100%", height: "8px", backgroundColor: "#f1f5f9", borderRadius: "999px", overflow: "hidden" }}>
                  <div style={{ width: `${catItem.percentage}%`, height: "100%", backgroundColor: catItem.color, borderRadius: "999px", transition: "width 0.5s ease" }}></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. TOP SPENDING & HIGHEST EXPENSE CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.25rem" }}>
        
        {/* Top Spending Category Card */}
        <div style={{ backgroundColor: "#ffffff", padding: "1.25rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.75rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>🔥</span> Top Spending Category
          </h4>
          {topCategory ? (
            <div>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#1e293b", margin: "0 0 0.25rem 0" }}>
                {topCategory.formattedCategory}
              </div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#ef4444" }}>
                {formatCurrency(topCategory.amount)} <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 500 }}>({topCategory.percentage}% of total expenses)</span>
              </div>
              <p style={{ fontSize: "0.775rem", color: "#64748b", marginTop: "0.5rem", margin: 0 }}>
                This is your primary spending driver based on transaction history.
              </p>
            </div>
          ) : (
            <p style={{ fontSize: "0.825rem", color: "#94a3b8", margin: 0 }}>No expense records available.</p>
          )}
        </div>

        {/* Highest Single Expense Card */}
        <div style={{ backgroundColor: "#ffffff", padding: "1.25rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.75rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>⚡</span> Highest Expense
          </h4>
          {highestExpenseTx ? (
            <div>
              <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.2rem 0" }}>
                {highestExpenseTx.title}
              </div>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#dc2626" }}>
                {formatCurrency(highestExpenseTx.amount)}
              </div>
              <div style={{ fontSize: "0.775rem", color: "#64748b", marginTop: "0.4rem" }}>
                Category: <strong style={{ color: "#334155", textTransform: "capitalize" }}>{highestExpenseTx.category}</strong> • Date: <strong style={{ color: "#334155" }}>{highestExpenseTx.date || (highestExpenseTx as any).transaction_date}</strong>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: "0.825rem", color: "#94a3b8", margin: 0 }}>No expense transactions recorded.</p>
          )}
        </div>

      </div>

      {/* 5. MONTHLY SPENDING & RECENT SPENDING INSIGHTS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
        
        {/* Monthly Spending Table */}
        <div style={{ backgroundColor: "#ffffff", padding: "1.25rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.85rem 0" }}>
            Monthly Spending
          </h4>
          {monthlySummaries.length === 0 ? (
            <p style={{ fontSize: "0.825rem", color: "#94a3b8", margin: 0 }}>No monthly records calculated.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.825rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                    <th style={{ padding: "0.5rem 0.25rem", fontWeight: 600 }}>Month</th>
                    <th style={{ padding: "0.5rem 0.25rem", fontWeight: 600, color: "#059669" }}>Income</th>
                    <th style={{ padding: "0.5rem 0.25rem", fontWeight: 600, color: "#dc2626" }}>Expense</th>
                    <th style={{ padding: "0.5rem 0.25rem", fontWeight: 600, textAlign: "right" }}>Net Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlySummaries.map((m) => (
                    <tr key={m.monthKey} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.6rem 0.25rem", fontWeight: 600, color: "#1e293b" }}>{m.formattedMonth}</td>
                      <td style={{ padding: "0.6rem 0.25rem", color: "#059669", fontWeight: 600 }}>₹{Math.round(m.income).toLocaleString("en-IN")}</td>
                      <td style={{ padding: "0.6rem 0.25rem", color: "#dc2626", fontWeight: 600 }}>₹{Math.round(m.expense).toLocaleString("en-IN")}</td>
                      <td style={{ padding: "0.6rem 0.25rem", fontWeight: 700, textAlign: "right", color: m.net >= 0 ? "#0284c7" : "#dc2626" }}>
                        ₹{Math.round(m.net).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Spending Insights */}
        <div style={{ backgroundColor: "#ffffff", padding: "1.25rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.85rem 0" }}>
            Spending Insights
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.825rem" }}>
            
            {/* Savings Rate Insight */}
            <div style={{ padding: "0.75rem", backgroundColor: "#f0fdf4", borderLeft: "4px solid #10b981", borderRadius: "0.375rem" }}>
              <div style={{ fontWeight: 700, color: "#166534" }}>Savings Rate: {savingsRate}%</div>
              <div style={{ color: "#15803d", marginTop: "0.15rem" }}>
                {savingsRate >= 20 ? "Great job! You are maintaining a healthy savings rate." : "Consider reviewing expenses to improve your net monthly savings."}
              </div>
            </div>

            {/* Total Volume Insight */}
            <div style={{ padding: "0.75rem", backgroundColor: "#f0f9ff", borderLeft: "4px solid #0284c7", borderRadius: "0.375rem" }}>
              <div style={{ fontWeight: 700, color: "#075985" }}>Recent Financial Activity</div>
              <div style={{ color: "#0369a1", marginTop: "0.15rem" }}>
                A total of <strong>{transactions.length}</strong> financial transactions tracked.
              </div>
            </div>

            {/* Cash Flow Balance Insight */}
            <div style={{ padding: "0.75rem", backgroundColor: netBalance >= 0 ? "#f8fafc" : "#fef2f2", borderLeft: netBalance >= 0 ? "4px solid #64748b" : "4px solid #ef4444", borderRadius: "0.375rem" }}>
              <div style={{ fontWeight: 700, color: netBalance >= 0 ? "#334155" : "#991b1b" }}>Cash Flow Status</div>
              <div style={{ color: netBalance >= 0 ? "#475569" : "#b91c1c", marginTop: "0.15rem" }}>
                {netBalance >= 0 ? "Positive cash balance. Income exceeds current logged expenses." : "Warning: Total expenses currently exceed recorded income."}
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};

export default BklitAnalyticsChart;
