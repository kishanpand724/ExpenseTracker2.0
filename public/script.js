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

        fetch("/view-transactions")
            .then(function (response) {
                if (!response.ok) {
                    throw new Error("Server returned status: " + response.status);
                }
                return response.json();
            })
            .then(function (transactions) {
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

        const txId = transaction.id || "";
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
                <button class="btn-edit" data-id="${txId}" style="background-color: var(--primary); color: white; border: none; padding: 0.35rem 0.65rem; border-radius: 4px; font-size: 0.775rem; font-weight: 500; cursor: pointer; margin-right: 0.35rem;">Edit</button>
                <button class="btn-delete" data-id="${txId}" title="Delete transaction">Delete</button>
            </td>
        `;

        const editBtn = row.querySelector(".btn-edit");
        if (editBtn) {
            editBtn.addEventListener("click", function () {
                editTransaction(transaction);
            });
        }

        const deleteBtn = row.querySelector(".btn-delete");
        if (deleteBtn) {
            deleteBtn.addEventListener("click", function () {
                const idToDelete = this.getAttribute("data-id");
                if (confirm("Are you sure you want to delete this transaction?")) {
                    deleteTransaction(idToDelete);
                }
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

            fetch("/edit-transaction", {
                method: "POST",
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
                if (window.refreshAnalyticsChart) window.refreshAnalyticsChart();
                window.dispatchEvent(new CustomEvent("transactionsUpdated"));
            })
            .catch(err => {
                console.error("Error editing transaction:", err);
                closeEditModal();
                loadTransactions();
                if (window.refreshAnalyticsChart) window.refreshAnalyticsChart();
                window.dispatchEvent(new CustomEvent("transactionsUpdated"));
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
        if (!id) {
            alert("Cannot delete: Missing transaction ID");
            return;
        }

        fetch("/delete-transaction", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json"
            },
            body: "id=" + encodeURIComponent(id)
        })
        .then(res => {
            if (!res.ok) {
                return res.json().then(data => { throw new Error(data.error || ("HTTP error " + res.status)); });
            }
            return res.json();
        })
        .then(data => {
            loadTransactions();
            if (window.refreshAnalyticsChart) window.refreshAnalyticsChart();
            window.dispatchEvent(new CustomEvent("transactionsUpdated"));
        })
        .catch(err => {
            console.error("Error deleting transaction:", err);
            alert("Failed to delete transaction: " + err.message);
            loadTransactions();
            if (window.refreshAnalyticsChart) window.refreshAnalyticsChart();
            window.dispatchEvent(new CustomEvent("transactionsUpdated"));
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

        const balance = totalIncome - totalExpense;

        const incomeCard = document.querySelector(".card-income .card-amount");
        const expenseCard = document.querySelector(".card-expense .card-amount");
        const balanceCard = document.querySelector(".card-balance .card-amount");

        if (incomeCard) incomeCard.textContent = "₹" + formatMoney(totalIncome);
        if (expenseCard) expenseCard.textContent = "₹" + formatMoney(totalExpense);
        if (balanceCard) balanceCard.textContent = "₹" + formatMoney(balance);
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
       SUBSCRIPTIONS MANAGEMENT
       ========================================== */
    function loadSubscriptions() {
        fetch("/api/subscriptions")
            .then(res => res.json())
            .then(subs => {
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
                        <div style="text-align: right; display: flex; align-items: center; gap: 1rem;">
                            <span style="font-size: 1.15rem; font-weight: 700; color: var(--expense);">₹${Number(sub.amount).toLocaleString("en-IN")}</span>
                            <button class="btn-delete" data-sub-id="${sub.id}">Remove</button>
                        </div>
                    `;

                    item.querySelector(".btn-delete").addEventListener("click", function() {
                        deleteSubscription(sub.id);
                    });

                    container.appendChild(item);
                });
            })
            .catch(err => console.error("Error loading subscriptions:", err));
    }

    function deleteSubscription(id) {
        fetch("/api/subscriptions/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        })
        .then(() => loadSubscriptions());
    }

    const subForm = document.getElementById("add-subscription-form");
    if (subForm) {
        subForm.addEventListener("submit", function(e) {
            e.preventDefault();
            const name = document.getElementById("sub-name").value;
            const category = document.getElementById("sub-category").value;
            const amount = document.getElementById("sub-amount").value;
            const nextBilling = document.getElementById("sub-next-date").value;

            fetch("/api/subscriptions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, category, amount, nextBilling })
            })
            .then(res => res.json())
            .then(data => {
                subForm.reset();
                loadSubscriptions();
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

            fetch("/add-transaction", {
                method: "POST",
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
       INITIAL LOAD
       ========================================== */
    loadTransactions();

});
