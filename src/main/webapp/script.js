document.addEventListener("DOMContentLoaded", function () {

    /* ==========================================
       GLOBAL STATE
       ========================================== */
    let allTransactionsData = [];

    /* ==========================================
       SIDEBAR NAVIGATION
       ========================================== */
    const navLinks = document.querySelectorAll(".sidebar-nav a");
    const sections = document.querySelectorAll(".content-section");

    navLinks.forEach(function (link) {
        link.addEventListener("click", function (event) {
            event.preventDefault();
            const targetSection = this.getAttribute("data-section");

            sections.forEach(function (section) {
                section.classList.remove("active-section");
            });

            const target = document.getElementById(targetSection);
            if (target) {
                target.classList.add("active-section");
            }

            navLinks.forEach(function (item) {
                item.parentElement.classList.remove("active");
            });

            this.parentElement.classList.add("active");

            // Re-render charts or section updates if active section opened
            if (targetSection === "dashboard-section") {
                renderExpenseOverviewChart(allTransactionsData);
            } else if (targetSection === "analytics-section") {
                renderAnalyticsSection(allTransactionsData);
            } else if (targetSection === "notifications-section") {
                renderNotifications(allTransactionsData);
            } else if (targetSection === "subscriptions-section") {
                loadSubscriptions();
            }
        });
    });

    const dashboardViewAll = document.getElementById("dashboard-view-all");
    if (dashboardViewAll) {
        dashboardViewAll.addEventListener("click", function (e) {
            e.preventDefault();
            const txLink = document.querySelector('.sidebar-nav a[data-section="transactions-section"]');
            if (txLink) txLink.click();
        });
    }

    // Default today's date in form
    const dateInput = document.getElementById("transaction_date");
    if (dateInput && !dateInput.value) {
        const today = new Date().toISOString().split("T")[0];
        dateInput.value = today;
    }

    /* ==========================================
       LOAD TRANSACTIONS
       ========================================== */
    function loadTransactions() {
        const recentBody = document.getElementById("recent-transactions-body");
        const allBody = document.getElementById("all-transactions-body");

        fetch("view-transactions", { credentials: "include" })
            .then(function (response) {
                if (response.status === 401) {
                    window.location.href = "login.html";
                    return null;
                }
                if (!response.ok) {
                    throw new Error("Server returned status: " + response.status);
                }
                return response.json();
            })
            .then(function (transactions) {
                if (!transactions) return;
                if (!Array.isArray(transactions)) {
                    console.error("Invalid transaction data:", transactions);
                    return;
                }

                allTransactionsData = transactions;
                loadRecentTransactions(transactions);
                loadAllTransactions(transactions);
                updateSummary(transactions);
                renderExpenseOverviewChart(transactions);
                renderAnalyticsSection(transactions);
                renderNotifications(transactions);
            })
            .catch(function (error) {
                console.error("Failed to load transactions:", error);
                if (recentBody) recentBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: #ef4444; padding: 1.5rem;">Error fetching transactions: ${escapeHTML(error.message)}</td></tr>`;
                if (allBody) allBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: #ef4444; padding: 1.5rem;">Error fetching transactions: ${escapeHTML(error.message)}</td></tr>`;
            });
    }

    /* ==========================================
       RECENT TRANSACTIONS
       ========================================== */
    function loadRecentTransactions(transactions) {
        const tbody = document.getElementById("recent-transactions-body");
        if (!tbody) return;

        tbody.innerHTML = "";

        if (transactions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">No transactions recorded yet.</td></tr>`;
            return;
        }

        transactions.slice(0, 5).forEach(function (transaction) {
            const row = createTransactionRow(transaction);
            tbody.appendChild(row);
        });
    }

    /* ==========================================
       ALL TRANSACTIONS
       ========================================== */
    function loadAllTransactions(transactions) {
        const tbody = document.getElementById("all-transactions-body");
        if (!tbody) return;

        tbody.innerHTML = "";

        if (transactions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">No transactions found.</td></tr>`;
            return;
        }

        transactions.forEach(function (transaction) {
            const row = createTransactionRow(transaction);
            tbody.appendChild(row);
        });
    }

    /* ==========================================
       CREATE TABLE ROW
       ========================================== */
    function createTransactionRow(transaction) {
        const row = document.createElement("tr");

        const type = String(transaction.type || "").toLowerCase();
        const isIncome = type === "income";
        const typeClass = isIncome ? "income" : "expense";
        const sign = isIncome ? "+" : "-";

        const formattedAmount = Number(transaction.amount || 0)
            .toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });

        const txId = (transaction.id !== undefined && transaction.id !== null) ? transaction.id : "";
        const txDate = transaction.date || transaction.transaction_date || "";

        row.innerHTML = `
            <td>${escapeHTML(txDate)}</td>
            <td><span style="text-transform: capitalize; font-weight: 500;">${escapeHTML(transaction.category)}</span></td>
            <td><strong>${escapeHTML(transaction.title)}</strong></td>
            <td>
                <span class="badge ${typeClass}">
                    ${escapeHTML(transaction.type)}
                </span>
            </td>
            <td class="amount ${typeClass}">
                ${sign}₹${formattedAmount}
            </td>
            <td>
                <div class="table-actions">
                    <button class="btn-edit" data-id="${txId}" title="Edit transaction">Edit</button>
                </div>
            </td>
        `;

        const editBtn = row.querySelector(".btn-edit");
        if (editBtn) {
            editBtn.addEventListener("click", function (e) {
                e.stopPropagation();
                editTransaction(transaction);
            });
        }

        return row;
    }

    /* ==========================================
       EDIT TRANSACTION MODAL
       ========================================== */
    const editModal = document.getElementById("edit-modal");
    const editForm = document.getElementById("edit-transaction-form");
    const closeEditBtn = document.getElementById("close-edit-modal");
    const cancelEditBtn = document.getElementById("cancel-edit-modal");

    function openEditModal(transaction) {
        if (!editModal) return;

        document.getElementById("edit-tx-id").value = transaction.id || "";
        document.getElementById("edit-tx-type").value = String(transaction.type || "expense").toLowerCase();
        document.getElementById("edit-tx-title").value = transaction.title || "";
        document.getElementById("edit-tx-amount").value = transaction.amount || "";

        let cat = String(transaction.category || "others").toLowerCase().trim();
        if (cat === "other") cat = "others";
        const catSelect = document.getElementById("edit-tx-category");
        if (catSelect) {
            catSelect.value = cat;
            if (catSelect.value !== cat) {
                catSelect.value = "others";
            }
        }

        let dateVal = transaction.date || transaction.transaction_date || new Date().toISOString().split("T")[0];
        if (typeof dateVal === "string" && dateVal.includes("T")) {
            dateVal = dateVal.split("T")[0];
        }
        document.getElementById("edit-tx-date").value = dateVal;

        editModal.style.display = "flex";
    }

    function closeEditModal() {
        if (editModal) editModal.style.display = "none";
    }

    if (closeEditBtn) closeEditBtn.addEventListener("click", closeEditModal);
    if (cancelEditBtn) cancelEditBtn.addEventListener("click", closeEditModal);

    if (editModal) {
        editModal.addEventListener("click", function (e) {
            if (e.target === editModal) closeEditModal();
        });
    }

    if (editForm) {
        editForm.addEventListener("submit", function (e) {
            e.preventDefault();

            const txId = document.getElementById("edit-tx-id").value;
            const type = document.getElementById("edit-tx-type").value;
            const title = document.getElementById("edit-tx-title").value.trim();
            const amount = document.getElementById("edit-tx-amount").value;
            const category = document.getElementById("edit-tx-category").value;
            const transactionDate = document.getElementById("edit-tx-date").value;

            if (!txId) {
                alert("Missing transaction ID for update.");
                return;
            }

            const params = new URLSearchParams({
                id: txId,
                type: type,
                title: title,
                amount: amount,
                category: category,
                transaction_date: transactionDate
            });

            fetch("edit-transaction", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json"
                },
                body: params.toString()
            })
            .then(res => {
                if (!res.ok) {
                    throw new Error("HTTP Error " + res.status);
                }
                return res.json();
            })
            .then(data => {
                closeEditModal();
                loadTransactions();
                window.dispatchEvent(new CustomEvent("transactionsUpdated"));
                if (typeof window.refreshAnalyticsChart === "function") window.refreshAnalyticsChart();
                if (typeof window.refreshDashboardPieChart === "function") window.refreshDashboardPieChart();
            })
            .catch(err => {
                console.error("Error editing transaction:", err);
                closeEditModal();
                loadTransactions();
                window.dispatchEvent(new CustomEvent("transactionsUpdated"));
                if (typeof window.refreshAnalyticsChart === "function") window.refreshAnalyticsChart();
                if (typeof window.refreshDashboardPieChart === "function") window.refreshDashboardPieChart();
            });
        });
    }

    function editTransaction(transaction) {
        openEditModal(transaction);
    }

    /* ==========================================
       DELETE TRANSACTION
       ========================================== */
    function deleteTransaction(id) {
        console.log(">>> [TRACE FRONTEND DELETE] Clicked Transaction ID:", id, "(type: " + typeof id + ")");

        if (id === undefined || id === null || String(id).trim() === "") {
            console.error(">>> [TRACE FRONTEND DELETE] Aborted: Missing transaction ID");
            alert("Cannot remove: Missing transaction ID");
            return;
        }

        const numId = parseInt(String(id), 10);
        const targetId = isNaN(numId) ? String(id).trim() : numId;

        const requestUrl = "/delete-transaction";
        const requestMethod = "POST";
        const payloadParams = new URLSearchParams();
        payloadParams.append("id", String(targetId));
        const payloadString = payloadParams.toString();

        console.log(">>> [TRACE FRONTEND DELETE] Sending Request:");
        console.log("    Request URL:", requestUrl);
        console.log("    Request Method:", requestMethod);
        console.log("    Request Payload:", payloadString, "({ id:", targetId, "})");

        fetch(requestUrl, {
            method: requestMethod,
            credentials: "include",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
                "X-Requested-With": "XMLHttpRequest"
            },
            body: payloadString
        })
        .then(res => {
            console.log(">>> [TRACE FRONTEND DELETE] Backend Response Status:", res.status, res.statusText);
            if (!res.ok) {
                return res.json().then(data => {
                    console.error(">>> [TRACE FRONTEND DELETE] Backend Response Error Body:", data);
                    throw new Error(data.error || ("HTTP " + res.status));
                });
            }
            return res.json();
        })
        .then(data => {
            console.log(">>> [TRACE FRONTEND DELETE] Backend Response Body:", data);
            loadTransactions();
            window.dispatchEvent(new CustomEvent("transactionsUpdated"));
            if (typeof window.refreshAnalyticsChart === "function") window.refreshAnalyticsChart();
            if (typeof window.refreshDashboardPieChart === "function") window.refreshDashboardPieChart();
        })
        .catch(err => {
            console.error(">>> [TRACE FRONTEND DELETE] Error in deleteTransaction:", err);
            loadTransactions();
            window.dispatchEvent(new CustomEvent("transactionsUpdated"));
            if (typeof window.refreshAnalyticsChart === "function") window.refreshAnalyticsChart();
            if (typeof window.refreshDashboardPieChart === "function") window.refreshDashboardPieChart();
        });
    }

    /* ==========================================
       SEARCH & FILTERS
       ========================================== */
    const searchInput = document.getElementById("search-input");
    const filterType = document.getElementById("filter-type");
    const filterCategory = document.getElementById("filter-category");

    function applyTransactionFilters() {
        const query = (searchInput ? searchInput.value : "").toLowerCase().trim();
        const selectedType = filterType ? filterType.value : "all";
        const selectedCategory = filterCategory ? filterCategory.value : "all";

        const filtered = allTransactionsData.filter(function (tx) {
            const title = String(tx.title || "").toLowerCase();
            const matchesSearch = !query || title.includes(query);

            const txType = String(tx.type || "").toLowerCase();
            const matchesType = selectedType === "all" || txType === selectedType;

            let txCat = String(tx.category || "").toLowerCase();
            if (txCat === "other") txCat = "others";
            const matchesCategory = selectedCategory === "all" || txCat === selectedCategory;

            return matchesSearch && matchesType && matchesCategory;
        });

        loadAllTransactions(filtered);
    }

    if (searchInput) searchInput.addEventListener("input", applyTransactionFilters);
    if (filterType) filterType.addEventListener("change", applyTransactionFilters);
    if (filterCategory) filterCategory.addEventListener("change", applyTransactionFilters);

    /* ==========================================
       DASHBOARD SUMMARY
       ========================================== */
    function updateSummary(transactions) {
        let totalIncome = 0;
        let totalExpense = 0;

        transactions.forEach(function (transaction) {
            const amount = Number(transaction.amount || 0);
            const type = String(transaction.type || "").toLowerCase();

            if (type === "income") {
                totalIncome += amount;
            } else if (type === "expense") {
                totalExpense += amount;
            }
        });

        fetch("api/subscriptions", { credentials: "include" })
            .then(res => res.ok ? res.json() : [])
            .then(subs => {
                if (Array.isArray(subs)) {
                    subs.forEach(s => {
                        if (String(s.status || "").toLowerCase() === "active") {
                            totalExpense += Number(s.amount || 0);
                        }
                    });
                }
                const balance = totalIncome - totalExpense;

                const incomeCard = document.querySelector(".card-income .card-amount");
                const expenseCard = document.querySelector(".card-expense .card-amount");
                const balanceCard = document.querySelector(".card-balance .card-amount");

                if (incomeCard) incomeCard.textContent = "₹" + formatMoney(totalIncome);
                if (expenseCard) expenseCard.textContent = "₹" + formatMoney(totalExpense);
                if (balanceCard) balanceCard.textContent = "₹" + formatMoney(balance);
            })
            .catch(() => {
                const balance = totalIncome - totalExpense;

                const incomeCard = document.querySelector(".card-income .card-amount");
                const expenseCard = document.querySelector(".card-expense .card-amount");
                const balanceCard = document.querySelector(".card-balance .card-amount");

                if (incomeCard) incomeCard.textContent = "₹" + formatMoney(totalIncome);
                if (expenseCard) expenseCard.textContent = "₹" + formatMoney(totalExpense);
                if (balanceCard) balanceCard.textContent = "₹" + formatMoney(balance);
            });
    }

    function formatMoney(amount) {
        return Number(amount || 0)
            .toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
    }

    function escapeHTML(value) {
        if (value === null || value === undefined) return "";
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /* ==========================================
       REAL NOTIFICATIONS ENGINE (100% REAL DATA)
       ========================================== */
    function renderNotifications(transactions) {
        const list = document.getElementById("notifications-list");
        if (!list) return;

        list.innerHTML = "";

        if (!transactions || transactions.length === 0) {
            list.innerHTML = `
                <div style="padding: 0.85rem; border-left: 4px solid var(--primary); background: #f8fafc; border-radius: 6px;">
                    <strong>ℹ️ No Transactions Recorded:</strong> Add income or expenses to view automated database alerts.
                </div>
            `;
            return;
        }

        let totalIncome = 0;
        let totalExpense = 0;
        const categoryExpenses = {};
        let highestExpenseTx = null;
        let latestIncomeTx = null;

        transactions.forEach(tx => {
            const amt = Number(tx.amount || 0);
            const type = String(tx.type || "").toLowerCase();
            let cat = String(tx.category || "others").toLowerCase();
            if (cat === "other") cat = "others";

            if (type === "income") {
                totalIncome += amt;
                if (!latestIncomeTx) latestIncomeTx = tx;
            } else if (type === "expense") {
                totalExpense += amt;
                categoryExpenses[cat] = (categoryExpenses[cat] || 0) + amt;
                if (!highestExpenseTx || amt > Number(highestExpenseTx.amount || 0)) {
                    highestExpenseTx = tx;
                }
            }
        });

        const balance = totalIncome - totalExpense;

        // 1. Account Balance Overview
        const balanceCard = document.createElement("div");
        balanceCard.style.cssText = "padding: 0.85rem; border-left: 4px solid var(--balance); background: #eff6ff; border-radius: 6px;";
        balanceCard.innerHTML = `<strong>💰 Account Balance Overview:</strong> Your net balance is <strong>₹${formatMoney(balance)}</strong> (Total Income: ₹${formatMoney(totalIncome)} | Total Expenses: ₹${formatMoney(totalExpense)}).`;
        list.appendChild(balanceCard);

        // 2. Most Recent Transaction Alert
        const latestTx = transactions[0];
        if (latestTx) {
            const isInc = String(latestTx.type).toLowerCase() === "income";
            const sign = isInc ? "+" : "-";
            const color = isInc ? "var(--income)" : "var(--expense)";
            const bg = isInc ? "#ecfdf5" : "#fef2f2";

            const recentCard = document.createElement("div");
            recentCard.style.cssText = `padding: 0.85rem; border-left: 4px solid ${color}; background: ${bg}; border-radius: 6px;`;
            recentCard.innerHTML = `<strong>⚡ Recent Activity (${escapeHTML(latestTx.date || latestTx.transaction_date)}):</strong> Logged <strong>${escapeHTML(latestTx.title)}</strong> [${escapeHTML(latestTx.category)}] for <span style="color:${color}; font-weight:700;">${sign}₹${formatMoney(latestTx.amount)}</span>.`;
            list.appendChild(recentCard);
        }

        // 3. Highest Single Expense Alert
        if (highestExpenseTx) {
            const highCard = document.createElement("div");
            highCard.style.cssText = "padding: 0.85rem; border-left: 4px solid var(--expense); background: #fef2f2; border-radius: 6px;";
            highCard.innerHTML = `<strong>⚠️ High Expense Alert:</strong> Highest single spending record is <strong>${escapeHTML(highestExpenseTx.title)}</strong> of <span style="color:var(--expense); font-weight:700;">₹${formatMoney(highestExpenseTx.amount)}</span> on ${escapeHTML(highestExpenseTx.date || highestExpenseTx.transaction_date)}.`;
            list.appendChild(highCard);
        }

        // 4. Highest Category Spending Alert
        const topCat = Object.keys(categoryExpenses).sort((a, b) => categoryExpenses[b] - categoryExpenses[a])[0];
        if (topCat) {
            const catName = topCat.charAt(0).toUpperCase() + topCat.slice(1);
            const catAmt = categoryExpenses[topCat];
            const pct = totalExpense > 0 ? Math.round((catAmt / totalExpense) * 100) : 0;

            const catCard = document.createElement("div");
            catCard.style.cssText = "padding: 0.85rem; border-left: 4px solid #f59e0b; background: #fffbeb; border-radius: 6px;";
            catCard.innerHTML = `<strong>📊 Category Insights:</strong> Your top spending category is <strong>${escapeHTML(catName)}</strong> at <strong>₹${formatMoney(catAmt)}</strong> (${pct}% of total expenses).`;
            list.appendChild(catCard);
        }

        // 5. Income Summary Alert
        if (latestIncomeTx) {
            const incCard = document.createElement("div");
            incCard.style.cssText = "padding: 0.85rem; border-left: 4px solid var(--income); background: #ecfdf5; border-radius: 6px;";
            incCard.innerHTML = `<strong>✅ Latest Income Logged:</strong> Received <strong>₹${formatMoney(latestIncomeTx.amount)}</strong> from <strong>${escapeHTML(latestIncomeTx.title)}</strong> on ${escapeHTML(latestIncomeTx.date || latestIncomeTx.transaction_date)}.`;
            list.appendChild(incCard);
        }
    }

    /* ==========================================
       RENDER EXPENSE OVERVIEW CHART (CANVAS)
       ========================================== */
    function renderExpenseOverviewChart(transactions) {
        const canvas = document.getElementById("expenseChart");
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        const categoryTotals = {};
        let totalExpense = 0;

        transactions.forEach(tx => {
            if (String(tx.type).toLowerCase() === "expense") {
                let cat = (tx.category || "others").toLowerCase();
                if (cat === "other") cat = "others";
                const amt = Number(tx.amount || 0);
                categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
                totalExpense += amt;
            }
        });

        const categories = Object.keys(categoryTotals);

        if (categories.length === 0 || totalExpense === 0) {
            ctx.fillStyle = "#64748b";
            ctx.font = "14px system-ui";
            ctx.textAlign = "center";
            ctx.fillText("No expense data available to display chart", width / 2, height / 2);
            return;
        }

        const colors = {
            food: "#f59e0b",
            travel: "#3b82f6",
            shopping: "#ec4899",
            bills: "#ef4444",
            entertainment: "#8b5cf6",
            education: "#10b981",
            others: "#64748b"
        };

        const centerX = width / 3;
        const centerY = height / 2;
        const outerRadius = Math.min(centerX, centerY) - 20;
        const innerRadius = outerRadius * 0.55;

        let startAngle = -Math.PI / 2;

        categories.forEach(cat => {
            const sliceAngle = (categoryTotals[cat] / totalExpense) * 2 * Math.PI;
            const endAngle = startAngle + sliceAngle;

            ctx.beginPath();
            ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
            ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
            ctx.closePath();

            ctx.fillStyle = colors[cat] || colors.others;
            ctx.fill();

            startAngle = endAngle;
        });

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 14px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("Total Spent", centerX, centerY - 6);

        ctx.font = "bold 13px system-ui";
        ctx.fillStyle = "#ef4444";
        ctx.fillText("₹" + Math.round(totalExpense).toLocaleString("en-IN"), centerX, centerY + 14);

        const legendX = width * 0.62;
        let legendY = 35;

        ctx.textAlign = "left";
        categories.forEach(cat => {
            const color = colors[cat] || colors.others;
            const amt = categoryTotals[cat];
            const pct = Math.round((amt / totalExpense) * 100);

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(legendX, legendY - 10, 12, 12, 3) : ctx.rect(legendX, legendY - 10, 12, 12);
            ctx.fill();

            ctx.fillStyle = "#1e293b";
            ctx.font = "500 12px system-ui";
            const formattedCat = cat.charAt(0).toUpperCase() + cat.slice(1);
            ctx.fillText(`${formattedCat}: ₹${amt.toLocaleString("en-IN")} (${pct}%)`, legendX + 20, legendY);

            legendY += 26;
        });
    }

    /* ==========================================
       RENDER ANALYTICS SECTION
       ========================================== */
    function renderAnalyticsSection(transactions) {
        const container = document.getElementById("category-bars-container");
        if (!container) return;

        container.innerHTML = "";

        const categoryTotals = {};
        let totalExpense = 0;

        transactions.forEach(tx => {
            if (String(tx.type).toLowerCase() === "expense") {
                let cat = (tx.category || "others").toLowerCase();
                if (cat === "other") cat = "others";
                const amt = Number(tx.amount || 0);
                categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
                totalExpense += amt;
            }
        });

        const categories = Object.keys(categoryTotals);
        if (categories.length === 0 || totalExpense === 0) {
            container.innerHTML = `<p style="color: var(--text-muted);">No expense records to analyze.</p>`;
            return;
        }

        const colors = {
            food: "#f59e0b",
            travel: "#3b82f6",
            shopping: "#ec4899",
            bills: "#ef4444",
            entertainment: "#8b5cf6",
            education: "#10b981",
            others: "#64748b"
        };

        categories.sort((a, b) => categoryTotals[b] - categoryTotals[a]).forEach(cat => {
            const amt = categoryTotals[cat];
            const pct = Math.round((amt / totalExpense) * 100);
            const color = colors[cat] || colors.others;
            const catName = cat.charAt(0).toUpperCase() + cat.slice(1);

            const barHtml = `
                <div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 0.25rem;">
                        <span style="font-weight: 600; color: var(--text-primary);">${catName}</span>
                        <span style="font-weight: 700; color: var(--text-secondary);">₹${amt.toLocaleString("en-IN")} (${pct}%)</span>
                    </div>
                    <div style="width: 100%; height: 10px; background-color: #e2e8f0; border-radius: 999px; overflow: hidden;">
                        <div style="width: ${pct}%; height: 100%; background-color: ${color}; border-radius: 999px; transition: width 0.5s ease;"></div>
                    </div>
                </div>
            `;
            container.innerHTML += barHtml;
        });

        renderAnalyticsBarChart(transactions);
    }

    function renderAnalyticsBarChart(transactions) {
        const canvas = document.getElementById("analyticsChart");
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        let inc = 0;
        let exp = 0;

        transactions.forEach(t => {
            if (String(t.type).toLowerCase() === "income") inc += Number(t.amount || 0);
            if (String(t.type).toLowerCase() === "expense") exp += Number(t.amount || 0);
        });

        const maxVal = Math.max(inc, exp, 1000);

        const barWidth = 80;
        const gap = 100;
        const startX = (w - (barWidth * 2 + gap)) / 2;
        const chartBottom = h - 40;
        const maxBarHeight = h - 90;

        const incHeight = (inc / maxVal) * maxBarHeight;
        const expHeight = (exp / maxVal) * maxBarHeight;

        const incX = startX;
        const incY = chartBottom - incHeight;
        ctx.fillStyle = "#10b981";
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(incX, incY, barWidth, incHeight, 8) : ctx.rect(incX, incY, barWidth, incHeight);
        ctx.fill();

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 13px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("Income", incX + barWidth / 2, chartBottom + 20);
        ctx.fillText("₹" + Math.round(inc).toLocaleString("en-IN"), incX + barWidth / 2, incY - 10);

        const expX = startX + barWidth + gap;
        const expY = chartBottom - expHeight;
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(expX, expY, barWidth, expHeight, 8) : ctx.rect(expX, expY, barWidth, expHeight);
        ctx.fill();

        ctx.fillText("Expense", expX + barWidth / 2, chartBottom + 20);
        ctx.fillText("₹" + Math.round(exp).toLocaleString("en-IN"), expX + barWidth / 2, expY - 10);
    }

    /* ==========================================
       EDIT SUBSCRIPTION MODAL & LOGIC
       ========================================== */
    const editSubModal = document.getElementById("edit-sub-modal");
    const editSubForm = document.getElementById("edit-subscription-form");
    const closeEditSubBtn = document.getElementById("close-edit-sub-modal");
    const cancelEditSubBtn = document.getElementById("cancel-edit-sub-modal");

    function openEditSubModal(sub) {
        if (!editSubModal) return;

        document.getElementById("edit-sub-id").value = sub.id || "";
        document.getElementById("edit-sub-name").value = sub.name || "";
        document.getElementById("edit-sub-amount").value = sub.amount || "";

        let cat = String(sub.category || "bills").toLowerCase().trim();
        const catSelect = document.getElementById("edit-sub-category");
        if (catSelect) {
            catSelect.value = cat;
            if (catSelect.value !== cat) catSelect.value = "others";
        }

        let cycle = sub.billingCycle || "Monthly";
        const cycleSelect = document.getElementById("edit-sub-cycle");
        if (cycleSelect) {
            cycleSelect.value = cycle;
        }

        let dateVal = sub.nextBilling || new Date().toISOString().split("T")[0];
        if (typeof dateVal === "string" && dateVal.includes("T")) {
            dateVal = dateVal.split("T")[0];
        }
        document.getElementById("edit-sub-next-date").value = dateVal;

        editSubModal.style.display = "flex";
    }

    function closeEditSubModal() {
        if (editSubModal) editSubModal.style.display = "none";
    }

    if (closeEditSubBtn) closeEditSubBtn.addEventListener("click", closeEditSubModal);
    if (cancelEditSubBtn) cancelEditSubBtn.addEventListener("click", closeEditSubModal);

    if (editSubModal) {
        editSubModal.addEventListener("click", function (e) {
            if (e.target === editSubModal) closeEditSubModal();
        });
    }

    if (editSubForm) {
        editSubForm.addEventListener("submit", function (e) {
            e.preventDefault();

            const subId = document.getElementById("edit-sub-id").value;
            const name = document.getElementById("edit-sub-name").value.trim();
            const category = document.getElementById("edit-sub-category").value;
            const amount = document.getElementById("edit-sub-amount").value;
            const billingCycle = document.getElementById("edit-sub-cycle").value;
            const nextBilling = document.getElementById("edit-sub-next-date").value;

            if (!subId || !name || !amount) {
                alert("Please fill in all required subscription details.");
                return;
            }

            fetch("api/subscriptions/update", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: subId,
                    name: name,
                    category: category,
                    amount: amount,
                    billingCycle: billingCycle,
                    nextBilling: nextBilling
                })
            })
            .then(res => {
                if (!res.ok) throw new Error("HTTP error " + res.status);
                return res.json();
            })
            .then(data => {
                closeEditSubModal();
                loadSubscriptions();
                loadTransactions();
                window.dispatchEvent(new CustomEvent("transactionsUpdated"));
                if (typeof window.refreshAnalyticsChart === "function") window.refreshAnalyticsChart();
                if (typeof window.refreshDashboardPieChart === "function") window.refreshDashboardPieChart();
            })
            .catch(err => {
                console.error("Error updating subscription:", err);
                alert("Error updating subscription: " + err.message);
            });
        });
    }

    /* ==========================================
       SUBSCRIPTIONS MANAGEMENT
       ========================================== */
    function loadSubscriptions() {
        fetch("api/subscriptions", { credentials: "include" })
            .then(res => {
                if (res.status === 401) {
                    window.location.href = "login.html";
                    return null;
                }
                return res.json();
            })
            .then(subs => {
                if (!subs) return;
                const container = document.getElementById("subscriptions-container");
                if (!container) return;

                container.innerHTML = "";
                if (!Array.isArray(subs) || subs.length === 0) {
                    container.innerHTML = `<p style="color: var(--text-muted);">No active subscriptions added.</p>`;
                    return;
                }

                subs.forEach(sub => {
                    const item = document.createElement("div");
                    item.className = "subscription-item";
                    item.innerHTML = `
                        <div>
                            <h3 style="font-size: 1rem; font-weight: 600; color: var(--text-primary);">${escapeHTML(sub.name)}</h3>
                            <p style="font-size: 0.825rem; color: var(--text-secondary); margin-top: 0.15rem;">
                                Category: <span style="text-transform: capitalize;">${escapeHTML(sub.category)}</span> • Cycle: ${escapeHTML(sub.billingCycle)}
                            </p>
                            <p style="font-size: 0.8rem; color: var(--primary); font-weight: 600; margin-top: 0.25rem;">
                                Next Billing: ${escapeHTML(sub.nextBilling)}
                            </p>
                        </div>
                        <div style="text-align: right; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; justify-content: flex-end;">
                            <span style="font-size: 1.15rem; font-weight: 700; color: var(--expense); margin-right: 0.25rem;">₹${Number(sub.amount).toLocaleString("en-IN")}</span>
                            <button class="btn-edit btn-edit-sub" data-sub-id="${sub.id}" style="padding: 0.35rem 0.75rem; font-size: 0.825rem; font-weight: 600;">Edit</button>
                            <button class="btn-delete btn-remove-sub" data-sub-id="${sub.id}" style="padding: 0.35rem 0.75rem; font-size: 0.825rem; font-weight: 600;">Remove</button>
                        </div>
                    `;

                    item.querySelector(".btn-edit-sub").addEventListener("click", function() {
                        openEditSubModal(sub);
                    });

                    item.querySelector(".btn-remove-sub").addEventListener("click", function() {
                        deleteSubscription(sub.id);
                    });

                    container.appendChild(item);
                });
            })
            .catch(err => console.error("Error loading subscriptions:", err));
    }

    function deleteSubscription(id) {
        fetch("api/subscriptions/delete", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        })
        .then(() => {
            loadSubscriptions();
            loadTransactions();
            window.dispatchEvent(new CustomEvent("transactionsUpdated"));
            if (typeof window.refreshAnalyticsChart === "function") window.refreshAnalyticsChart();
            if (typeof window.refreshDashboardPieChart === "function") window.refreshDashboardPieChart();
        });
    }

    const subForm = document.getElementById("add-subscription-form");
    if (subForm) {
        subForm.addEventListener("submit", function(e) {
            e.preventDefault();
            const name = document.getElementById("sub-name").value;
            const category = document.getElementById("sub-category").value;
            const amount = document.getElementById("sub-amount").value;
            const nextBilling = document.getElementById("sub-next-date").value;

            fetch("api/subscriptions", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, category, amount, nextBilling })
            })
            .then(res => res.json())
            .then(data => {
                subForm.reset();
                loadSubscriptions();
                loadTransactions();
                window.dispatchEvent(new CustomEvent("transactionsUpdated"));
                if (typeof window.refreshAnalyticsChart === "function") window.refreshAnalyticsChart();
                if (typeof window.refreshDashboardPieChart === "function") window.refreshDashboardPieChart();
            });
        });
    }

    /* ==========================================
       ADD TRANSACTION (AJAX)
       ========================================== */
    const form = document.getElementById("quick-add-form");

    if (form) {
        form.addEventListener("submit", function (event) {
            event.preventDefault();

            const title = document.getElementById("transaction-title");
            const amount = document.getElementById("transaction-amount");
            const date = document.getElementById("transaction_date");

            if (!title.value.trim()) {
                alert("Please enter transaction title.");
                title.focus();
                return;
            }

            if (!amount.value || Number(amount.value) <= 0) {
                alert("Please enter a valid amount.");
                amount.focus();
                return;
            }

            if (!date.value) {
                alert("Please select transaction date.");
                date.focus();
                return;
            }

            const formData = new URLSearchParams(new FormData(form));

            fetch("add-transaction", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json"
                },
                body: formData.toString()
            })
            .then(res => {
                if (!res.ok) {
                    throw new Error("HTTP error " + res.status);
                }
                return res.json();
            })
            .then(data => {
                form.reset();
                if (dateInput) {
                    dateInput.value = new Date().toISOString().split("T")[0];
                }
                loadTransactions();
                if (window.refreshAnalyticsChart) window.refreshAnalyticsChart();
                window.dispatchEvent(new CustomEvent("transactionsUpdated"));
            })
            .catch(err => {
                console.error("Error submitting form:", err);
                alert("Database insert error: " + err.message);
            });
        });
    }

    /* ==========================================
       AUTHENTICATION SYSTEM
       ========================================== */
    const authContainer = document.getElementById("auth-container");
    const mainAppContainer = document.getElementById("main-app-container");
    const loginCard = document.getElementById("login-card");
    const signupCard = document.getElementById("signup-card");
    const showSignupLink = document.getElementById("show-signup-link");
    const showLoginLink = document.getElementById("show-login-link");
    const forgotPasswordLink = document.getElementById("forgot-password-link");
    const loginForm = document.getElementById("login-form");
    const signupForm = document.getElementById("signup-form");
    const loginAlert = document.getElementById("login-alert");
    const signupAlert = document.getElementById("signup-alert");
    const logoutBtn = document.getElementById("logout-btn");

    function showAuthAlert(element, message, type) {
        if (!element) return;
        element.textContent = message;
        element.className = `auth-alert ${type}`;
        element.style.display = "block";
    }

    function clearAuthAlerts() {
        if (loginAlert) {
            loginAlert.style.display = "none";
            loginAlert.textContent = "";
        }
        if (signupAlert) {
            signupAlert.style.display = "none";
            signupAlert.textContent = "";
        }
    }

    function checkAuthStatus(retryCount = 0) {
        fetch("session-check", {
            method: "GET",
            credentials: "include",
            headers: {
                "Accept": "application/json",
                "Cache-Control": "no-cache"
            }
        })
            .then(async res => {
                if (res.status === 401) {
                    return { authenticated: false };
                }
                const contentType = res.headers.get("content-type") || "";
                if (contentType.includes("application/json")) {
                    try {
                        return await res.json();
                    } catch (e) {
                        return null;
                    }
                }
                const text = await res.text();
                try {
                    return JSON.parse(text);
                } catch (e) {
                    return null;
                }
            })
            .then(data => {
                if (data && (data.authenticated === true || data.user_id || data.user)) {
                    const user = data.user || { id: data.user_id, name: data.name || "User", email: data.email || "" };
                    const nameElem = document.getElementById("user-display-name");
                    const emailElem = document.getElementById("user-display-email");
                    const avatarElem = document.getElementById("user-avatar-circle");

                    if (nameElem) nameElem.textContent = user.name || "User";
                    if (emailElem) emailElem.textContent = user.email || "";
                    if (avatarElem && user.name) {
                        avatarElem.textContent = user.name.charAt(0).toUpperCase();
                    }

                    if (authContainer) authContainer.style.display = "none";
                    if (mainAppContainer) mainAppContainer.style.display = "flex";

                    loadTransactions();
                    loadSubscriptions();
                } else if (data && data.authenticated === false) {
                    // Explicitly confirmed unauthenticated by backend
                    window.location.href = "login.html";
                } else {
                    // Response in unexpected format, retry before redirecting
                    if (retryCount < 2) {
                        setTimeout(() => checkAuthStatus(retryCount + 1), 500);
                    } else {
                        window.location.href = "login.html";
                    }
                }
            })
            .catch(err => {
                console.warn("Session check retry or error:", err);
                if (retryCount < 2) {
                    setTimeout(() => checkAuthStatus(retryCount + 1), 500);
                }
            });
    }

    if (showSignupLink) {
        showSignupLink.addEventListener("click", function (e) {
            e.preventDefault();
            window.location.href = "signup.html";
        });
    }

    if (showLoginLink) {
        showLoginLink.addEventListener("click", function (e) {
            e.preventDefault();
            window.location.href = "login.html";
        });
    }

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener("click", function (e) {
            e.preventDefault();
            showAuthAlert(loginAlert, "Password reset functionality placeholder.", "success");
        });
    }

    if (loginForm) {
        loginForm.addEventListener("submit", function (e) {
            e.preventDefault();
            clearAuthAlerts();

            const email = document.getElementById("login-email").value.trim();
            const password = document.getElementById("login-password").value;

            const submitBtn = document.getElementById("login-submit-btn");
            if (submitBtn) submitBtn.disabled = true;

            fetch("login", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                body: "email=" + encodeURIComponent(email) + "&password=" + encodeURIComponent(password)
            })
            .then(res => res.json())
            .then(data => {
                if (submitBtn) submitBtn.disabled = false;
                if (!data.success) {
                    showAuthAlert(loginAlert, data.error || "Login failed.", "error");
                } else {
                    window.location.href = "index.html";
                }
            })
            .catch(err => {
                if (submitBtn) submitBtn.disabled = false;
                showAuthAlert(loginAlert, "Connection error: " + err.message, "error");
            });
        });
    }

    if (signupForm) {
        signupForm.addEventListener("submit", function (e) {
            e.preventDefault();
            clearAuthAlerts();

            const name = document.getElementById("signup-name").value.trim();
            const email = document.getElementById("signup-email").value.trim();
            const password = document.getElementById("signup-password").value;
            const confirmPassword = document.getElementById("signup-confirm-password").value;

            if (password !== confirmPassword) {
                showAuthAlert(signupAlert, "Password and Confirm Password do not match.", "error");
                return;
            }

            if (password.length < 6) {
                showAuthAlert(signupAlert, "Password must be at least 6 characters.", "error");
                return;
            }

            const submitBtn = document.getElementById("signup-submit-btn");
            if (submitBtn) submitBtn.disabled = true;

            fetch("signup", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                body: "name=" + encodeURIComponent(name)
                    + "&email=" + encodeURIComponent(email)
                    + "&password=" + encodeURIComponent(password)
                    + "&confirmPassword=" + encodeURIComponent(confirmPassword)
            })
            .then(res => res.json())
            .then(data => {
                if (submitBtn) submitBtn.disabled = false;
                if (!data.success) {
                    showAuthAlert(signupAlert, data.error || "Account creation failed.", "error");
                } else {
                    window.location.href = "login.html?registered=true";
                }
            })
            .catch(err => {
                if (submitBtn) submitBtn.disabled = false;
                showAuthAlert(signupAlert, "Connection error: " + err.message, "error");
            });
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", function (e) {
            e.preventDefault();
            fetch("logout", { method: "POST", credentials: "include" })
                .then(res => res.json().catch(() => ({})))
                .then(data => {
                    const target = (data && data.redirect) ? data.redirect : "login.html?logout=true";
                    window.location.href = target;
                })
                .catch(() => {
                    window.location.href = "login.html?logout=true";
                });
        });
    }

    /* ==========================================
       INITIAL LOAD
       ========================================== */
    checkAuthStatus();

});
