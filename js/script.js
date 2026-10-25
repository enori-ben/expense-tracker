
"use strict";

// ==========================================
// ExpenseFlow - Personal Finance Dashboard
// ==========================================

const STORAGE_KEY = "expenseflow.transactions.v1";

const CATEGORIES = [
    "Salary", "Freelance", "Food", "Transport",
    "Shopping", "Bills", "Health", "Education", "Other"
];

const elements = {
    balance: document.getElementById("total-balance"),
    income: document.getElementById("total-income"),
    expenses: document.getElementById("total-expenses"),
    list: document.getElementById("transaction-list"),
    count: document.getElementById("transaction-count"),
    empty: document.getElementById("empty-state"),
    search: document.getElementById("search-input"),
    typeFilter: document.getElementById("type-filter"),
    categoryFilter: document.getElementById("category-filter"),
    breakdown: document.getElementById("category-breakdown"),
    dialog: document.getElementById("transaction-dialog"),
    form: document.getElementById("transaction-form"),
    title: document.getElementById("transaction-title"),
    amount: document.getElementById("transaction-amount"),
    type: document.getElementById("transaction-type"),
    category: document.getElementById("transaction-category"),
    date: document.getElementById("transaction-date"),
    error: document.getElementById("form-error"),
    toast: document.getElementById("toast")
};

let transactions = loadTransactions();
let toastTimeout;

// ==========================================
// 1. Storage
// ==========================================

function loadTransactions() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) return [];

        const parsed = JSON.parse(saved);

        if (!Array.isArray(parsed)) return [];

        return parsed.filter(isValidTransaction);
    } catch (error) {
        console.error("Could not load transactions:", error);
        return [];
    }
}

function isValidTransaction(item) {
    return item !== null
        && typeof item === "object"
        && typeof item.id === "string"
        && typeof item.title === "string"
        && item.title.trim().length > 0
        && item.title.length <= 80
        && Number.isFinite(item.amount)
        && item.amount > 0
        && item.amount <= 1_000_000_000_000
        && ["income", "expense"].includes(item.type)
        && CATEGORIES.includes(item.category)
        && typeof item.date === "string"
        && isValidDate(item.date);
}

function saveTransactions() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(transactions)
        );
        return true;
    } catch (error) {
        console.error("Could not save transactions:", error);
        showToast("Could not save data. Check browser storage.");
        return false;
    }
}

// ==========================================
// 2. Formatting helpers
// ==========================================

const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "DZD",
    maximumFractionDigits: 2
});

function formatMoney(amount) {
    return currencyFormatter.format(amount);
}

function formatDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);

    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(new Date(year, month - 1, day));
}

function getLocalDate() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60_000;

    return new Date(now.getTime() - offset)
        .toISOString()
        .slice(0, 10);
}

function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    return date.getFullYear() === year
        && date.getMonth() === month - 1
        && date.getDate() === day;
}

function createId() {
    if (typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ==========================================
// 3. Dashboard summary
// ==========================================

function updateSummary() {
    const income = transactions
        .filter(item => item.type === "income")
        .reduce((sum, item) => sum + item.amount, 0);

    const expenses = transactions
        .filter(item => item.type === "expense")
        .reduce((sum, item) => sum + item.amount, 0);

    const balance = income - expenses;

    elements.balance.textContent = formatMoney(balance);
    elements.income.textContent = formatMoney(income);
    elements.expenses.textContent = formatMoney(expenses);

    elements.balance.style.color =
        balance < 0 ? "var(--red)" : "var(--text)";
}

// ==========================================
// 4. Transaction table
// ==========================================

function createCell(className, text) {
    const cell = document.createElement("td");

    if (className) cell.className = className;

    cell.textContent = text;

    return cell;
}

function renderTransactions() {
    const query = elements.search.value.trim().toLowerCase();
    const selectedType = elements.typeFilter.value;
    const selectedCategory = elements.categoryFilter.value;

    const filtered = transactions
        .filter(item => {
            const matchesSearch =
                item.title.toLowerCase().includes(query)
                || item.category.toLowerCase().includes(query);

            const matchesType =
                selectedType === "all" || item.type === selectedType;

            const matchesCategory =
                selectedCategory === "all"
                || item.category === selectedCategory;

            return matchesSearch && matchesType && matchesCategory;
        })
        .sort((a, b) => {
            const dateComparison = b.date.localeCompare(a.date);

            if (dateComparison !== 0) return dateComparison;

            return b.id.localeCompare(a.id);
        });

    elements.list.replaceChildren();

    filtered.forEach(item => {
        const row = document.createElement("tr");

        const descriptionCell = document.createElement("td");
        const title = document.createElement("span");
        const subtitle = document.createElement("span");

        title.className = "transaction-name";
        title.textContent = item.title;

        subtitle.className = "transaction-subtitle";
        subtitle.textContent =
            item.type === "income" ? "Money received" : "Money spent";

        descriptionCell.append(title, subtitle);

        const categoryCell = createCell("", item.category);
        const categoryTag = document.createElement("span");

        categoryTag.className = "category-tag";
        categoryTag.textContent = item.category;

        categoryCell.replaceChildren(categoryTag);

        const dateCell = createCell("", formatDate(item.date));

        const amountCell = createCell(
            item.type === "income" ? "amount-income" : "amount-expense",
            `${item.type === "income" ? "+" : "−"}${formatMoney(item.amount)}`
        );

        const actionCell = document.createElement("td");
        const deleteButton = document.createElement("button");

        deleteButton.type = "button";
        deleteButton.className = "delete-button";
        deleteButton.textContent = "Delete";
        deleteButton.setAttribute(
            "aria-label",
            `Delete transaction: ${item.title}`
        );

        deleteButton.addEventListener("click", () => {
            deleteTransaction(item.id);
        });

        actionCell.append(deleteButton);
        row.append(
            descriptionCell,
            categoryCell,
            dateCell,
            amountCell,
            actionCell
        );

        elements.list.append(row);
    });

    elements.count.textContent =
        `${filtered.length} ${filtered.length === 1 ? "record" : "records"}`;

    elements.empty.hidden = filtered.length > 0;

    const emptyHeading = elements.empty.querySelector("h3");
    const emptyMessage = elements.empty.querySelector("p");
    const emptyButton = document.getElementById("empty-add-btn");

    if (transactions.length > 0 && filtered.length === 0) {
        emptyHeading.textContent = "No matching transactions";
        emptyMessage.textContent = "Try changing your search or filters.";
        emptyButton.hidden = true;
    } else {
        emptyHeading.textContent = "No transactions yet";
        emptyMessage.textContent =
            "Add your first transaction to start tracking your money.";
        emptyButton.hidden = false;
    }
}

// ==========================================
// 5. Expense breakdown
// ==========================================

function renderBreakdown() {
    const expenses = transactions.filter(
        item => item.type === "expense"
    );

    const totals = {};

    expenses.forEach(item => {
        totals[item.category] =
            (totals[item.category] || 0) + item.amount;
    });

    const categories = Object.entries(totals)
        .sort((a, b) => b[1] - a[1]);

    elements.breakdown.replaceChildren();

    if (categories.length === 0) {
        const message = document.createElement("p");
        message.className = "muted";
        message.textContent =
            "Your expense categories will appear here.";
        elements.breakdown.append(message);
        return;
    }

    const totalExpenses = expenses.reduce(
        (sum, item) => sum + item.amount,
        0
    );

    categories.forEach(([category, amount]) => {
        const percentage = totalExpenses > 0
            ? (amount / totalExpenses) * 100
            : 0;

        const item = document.createElement("div");
        item.className = "breakdown-item";

        const heading = document.createElement("div");
        heading.className = "breakdown-heading";

        const name = document.createElement("span");
        name.textContent = category;

        const value = document.createElement("span");
        value.textContent =
            `${formatMoney(amount)} · ${percentage.toFixed(1)}%`;

        heading.append(name, value);

        const track = document.createElement("div");
        track.className = "progress-track";

        const fill = document.createElement("div");
        fill.className = "progress-fill";
        fill.style.width = `${percentage}%`;

        track.append(fill);
        item.append(heading, track);
        elements.breakdown.append(item);
    });
}

// ==========================================
// 6. Add and delete transactions
// ==========================================

function refreshDashboard() {
    updateSummary();
    renderTransactions();
    renderBreakdown();
}

function addTransaction(data) {
    const transaction = {
        id: createId(),
        title: data.title.trim(),
        amount: Number(data.amount),
        type: data.type,
        category: data.category,
        date: data.date
    };

    if (!isValidTransaction(transaction)) {
        elements.error.textContent =
            "Please enter valid transaction details.";
        return;
    }

    transactions.push(transaction);

    if (!saveTransactions()) {
        transactions.pop();
        return;
    }

    refreshDashboard();
    elements.form.reset();
    elements.date.value = getLocalDate();
    elements.type.value = "expense";
    elements.category.value = "Food";
    elements.error.textContent = "";
    elements.dialog.close();

    showToast("Transaction added successfully.");
}

function deleteTransaction(id) {
    const index = transactions.findIndex(item => item.id === id);

    if (index === -1) return;

    const [removed] = transactions.splice(index, 1);

    if (!saveTransactions()) {
        transactions.splice(index, 0, removed);
        return;
    }

    refreshDashboard();
    showToast("Transaction deleted.");
}

// ==========================================
// 7. Dialog and notifications
// ==========================================

function openDialog() {
    elements.error.textContent = "";
    elements.form.reset();
    elements.date.value = getLocalDate();
    elements.type.value = "expense";
    elements.category.value = "Food";

    elements.dialog.showModal();
    elements.title.focus();
}

function showToast(message) {
    clearTimeout(toastTimeout);

    elements.toast.textContent = message;
    elements.toast.classList.add("show");

    toastTimeout = setTimeout(() => {
        elements.toast.classList.remove("show");
    }, 2800);
}

// ==========================================
// 8. Event listeners
// ==========================================

document.getElementById("add-transaction-btn")
    .addEventListener("click", openDialog);

document.getElementById("empty-add-btn")
    .addEventListener("click", openDialog);

document.getElementById("close-dialog")
    .addEventListener("click", () => elements.dialog.close());

document.getElementById("cancel-dialog")
    .addEventListener("click", () => elements.dialog.close());

elements.form.addEventListener("submit", event => {
    event.preventDefault();

    if (!elements.form.reportValidity()) return;

    addTransaction({
        title: elements.title.value,
        amount: elements.amount.value,
        type: elements.type.value,
        category: elements.category.value,
        date: elements.date.value
    });
});

elements.search.addEventListener("input", renderTransactions);
elements.typeFilter.addEventListener("change", renderTransactions);
elements.categoryFilter.addEventListener("change", renderTransactions);

// ==========================================
// 9. Initialize application
// ==========================================

refreshDashboard();
