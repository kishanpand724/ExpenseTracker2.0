document.addEventListener("DOMContentLoaded", function () {

    /* ==========================================
       GLOBAL STATE & CACHE
       ========================================== */
    let allTransactionsData = [];
    let javaCodeCache = {};

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

            // Re-render chart or code inspector if active section opened
            if (targetSection === "dashboard-section") {
                renderExpenseOverviewChart(allTransactionsData);
            } else if (targetSection === "analytics-section") {
                renderAnalyticsSection(allTransactionsData);
            } else if (targetSection === "settings-section") {
                loadJavaCode();
                checkDbStatus();
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

    /* ==========================================
       QUICK ADD BUTTON
       ========================================== */

    const quickAddButton = document.getElementById("quick-add-btn");
    const quickAddSection = document.getElementById("quick-add-section");

    if (quickAddButton && quickAddSection) {

        quickAddButton.addEventListener("click", function () {

            quickAddSection.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

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

        fetch("view-transactions")
            .then(function (response) {

                if (!response.ok) {
                    throw new Error(
                        "Server returned status: "
                        + response.status
                    );
                }

                return response.json();
            })

            .then(function (transactions) {

                if (!Array.isArray(transactions)) {

                    console.error(
                        "Invalid transaction data:",
                        transactions
                    );

                    return;
                }

                allTransactionsData = transactions;
                loadRecentTransactions(transactions);
                loadAllTransactions(transactions);
                updateSummary(transactions);
                renderExpenseOverviewChart(transactions);
                renderAnalyticsSection(transactions);
            })

            .catch(function (error) {

                console.error(
                    "Failed to load transactions:",
                    error
                );
            });
    }


    /* ==========================================
       RECENT TRANSACTIONS
       ========================================== */

    function loadRecentTransactions(transactions) {

        const tbody = document.getElementById("recent-transactions-body");

        if (!tbody) {
            return;
        }

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

        if (!tbody) {
            return;
        }

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

        const txId = transaction.id || transaction.title || "";
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
                <button class="btn-delete" data-id="${txId}" title="Delete transaction">Delete</button>
            </td>
        `;

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
       DELETE TRANSACTION
       ========================================== */

    function deleteTransaction(id) {
        fetch("delete-transaction", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json"
            },
            body: "id=" + encodeURIComponent(id)
        })
        .then(res => res.json())
        .then(data => {
            loadTransactions();
        })
        .catch(err => {
            console.error("Error deleting transaction:", err);
            loadTransactions();
        });
    }


    /* ==========================================
       FILTER TRANSACTIONS
       ========================================== */

    const searchInput = document.getElementById("search-input");
    const filterType = document.getElementById("filter-type");
    const filterCategory = document.getElementById("filter-category");

    function applyTransactionFilters() {
        if (!allTransactionsData) return;

        const searchTerm = (searchInput ? searchInput.value : "").toLowerCase().trim();
        const selectedType = filterType ? filterType.value : "all";
        const selectedCategory = filterCategory ? filterCategory.value : "all";

        const filtered = allTransactionsData.filter(function (tx) {
            const matchesSearch = !searchTerm ||
                String(tx.title || "").toLowerCase().includes(searchTerm) ||
                String(tx.category || "").toLowerCase().includes(searchTerm);

            const txType = String(tx.type || "").toLowerCase();
            const matchesType = selectedType === "all" || txType === selectedType;

            const txCat = String(tx.category || "").toLowerCase();
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


        if (incomeCard) {

            incomeCard.textContent = "₹" + formatMoney(totalIncome);
        }

        if (expenseCard) {

            expenseCard.textContent = "₹" + formatMoney(totalExpense);
        }

        if (balanceCard) {

            balanceCard.textContent = "₹" + formatMoney(balance);
        }
    }


    /* ==========================================
       MONEY FORMAT
       ========================================== */

    function formatMoney(amount) {

        return Number(amount || 0)
            .toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
    }


    /* ==========================================
       HTML SAFETY
       ========================================== */

    function escapeHTML(value) {

        if (value === null || value === undefined) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
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

        // Calculate expense totals by category
        const categoryTotals = {};
        let totalExpense = 0;

        transactions.forEach(tx => {
            if (String(tx.type).toLowerCase() === "expense") {
                const cat = (tx.category || "others").toLowerCase();
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

        // Color palette for categories
        const colors = {
            food: "#f59e0b",
            travel: "#3b82f6",
            shopping: "#ec4899",
            bills: "#ef4444",
            entertainment: "#8b5cf6",
            education: "#10b981",
            others: "#64748b"
        };

        // Draw Donut Chart
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

        // Center Text
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 14px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("Total Spent", centerX, centerY - 6);

        ctx.font = "bold 13px system-ui";
        ctx.fillStyle = "#ef4444";
        ctx.fillText("₹" + Math.round(totalExpense).toLocaleString("en-IN"), centerX, centerY + 14);

        // Draw Legend
        const legendX = width * 0.62;
        let legendY = 35;

        ctx.textAlign = "left";
        categories.forEach(cat => {
            const color = colors[cat] || colors.others;
            const amt = categoryTotals[cat];
            const pct = Math.round((amt / totalExpense) * 100);

            // Color box
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(legendX, legendY - 10, 12, 12, 3) : ctx.rect(legendX, legendY - 10, 12, 12);
            ctx.fill();

            // Label
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
                const cat = (tx.category || "others").toLowerCase();
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

        // Also render analytics comparison chart
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

        // Income Bar
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

        // Expense Bar
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
       DATABASE CONNECTION CONFIGURATION
       ========================================== */

    function checkDbStatus() {
        const statusEl = document.getElementById("db-conn-status");
        const urlInput = document.getElementById("db-connection-url");

        fetch("/api/db-config")
            .then(res => res.json())
            .then(data => {
                if (urlInput && data.db_url) {
                    urlInput.value = data.db_url;
                }
                if (statusEl) {
                    if (data.isConnected) {
                        statusEl.innerHTML = `<span style="color: #10b981;">🟢 Connected to External PostgreSQL DB</span>`;
                    } else {
                        statusEl.innerHTML = `<span style="color: #f59e0b;">🟠 Using Embedded Local PostgreSQL</span>`;
                    }
                }
            })
            .catch(() => {
                if (statusEl) statusEl.textContent = "Error checking DB status";
            });
    }

    const dbConfigForm = document.getElementById("db-config-form");
    if (dbConfigForm) {
        dbConfigForm.addEventListener("submit", function(e) {
            e.preventDefault();
            const dbUrl = document.getElementById("db-connection-url").value;
            const statusEl = document.getElementById("db-conn-status");

            if (statusEl) statusEl.innerHTML = `<span style="color: #3b82f6;">⏳ Connecting & verifying schema...</span>`;

            fetch("/api/db-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ db_url: dbUrl })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert(data.message);
                    checkDbStatus();
                    loadTransactions();
                } else {
                    alert("Error: " + (data.error || "Failed to connect"));
                    checkDbStatus();
                }
            })
            .catch(err => {
                alert("Connection failed: " + err.message);
                checkDbStatus();
            });
        });
    }

    /* ==========================================
       JAVA CODE INSPECTOR (SETTINGS TAB)
       ========================================== */

    function loadJavaCode() {
        if (Object.keys(javaCodeCache).length > 0) {
            showTabCode("tab-db");
            return;
        }

        fetch("/api/java-code")
            .then(res => res.json())
            .then(data => {
                javaCodeCache = data;
                showTabCode("tab-db");
            })
            .catch(err => {
                const codeDisplay = document.getElementById("code-display");
                if (codeDisplay) codeDisplay.textContent = "Failed to load Java source code.";
            });
    }

    function showTabCode(tabId) {
        const codeDisplay = document.getElementById("code-display");
        if (!codeDisplay) return;

        let content = "";
        if (tabId === "tab-db") content = javaCodeCache.dbJava || "";
        else if (tabId === "tab-view") content = javaCodeCache.viewServlet || "";
        else if (tabId === "tab-add") content = javaCodeCache.addServlet || "";
        else if (tabId === "tab-schema") content = javaCodeCache.schemaSql || "";
        else if (tabId === "tab-webxml") content = javaCodeCache.webXml || "";

        codeDisplay.textContent = content;
    }

    const tabBtns = document.querySelectorAll(".tab-btn");
    tabBtns.forEach(btn => {
        btn.addEventListener("click", function() {
            tabBtns.forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            const targetTab = this.getAttribute("data-tab");
            showTabCode(targetTab);
        });
    });


    /* ==========================================
       FORM VALIDATION & AJAX ADD TRANSACTION
       ========================================== */

    const form = document.getElementById("quick-add-form");

    if (form) {

        form.addEventListener("submit", function (event) {

            const title = document.getElementById("transaction-title");
            const amount = document.getElementById("transaction-amount");
            const date = document.getElementById("transaction_date");

            if (!title.value.trim()) {
                event.preventDefault();
                alert("Please enter transaction title.");
                title.focus();
                return;
            }

            if (!amount.value || Number(amount.value) <= 0) {
                event.preventDefault();
                alert("Please enter a valid amount.");
                amount.focus();
                return;
            }

            if (!date.value) {
                event.preventDefault();
                alert("Please select transaction date.");
                date.focus();
                return;
            }

            // Perform smooth AJAX POST to keep single page experience fast
            event.preventDefault();

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
