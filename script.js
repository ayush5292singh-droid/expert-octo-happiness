
"use strict";

const STORAGE_KEY = "FINOVA_NEW_PREMIUM_APP_V1";
const $ = id => document.getElementById(id);

const CATEGORIES = [
  "Food", "Transport", "Shopping", "Bills", "Entertainment",
  "Health", "Education", "Rent", "Salary", "Investment",
  "Travel", "Other"
];

const money = value => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
}).format(Number(value) || 0);

const round = value => Math.round((Number(value) || 0) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);
const monthKey = date => String(date || today()).slice(0, 7);
const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

function freshData() {
  return {
    profile: { name: "", age: "" },
    onboarded: false,
    transactions: [],
    wallets: [{ id: "main-wallet", name: "Main Wallet", type: "Cash", balance: 0 }],
    budgets: [],
    goals: [],
    loans: [],
    bills: [],
    pro: false
  };
}

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === "object") {
      const base = freshData();
      return {
        ...base,
        ...saved,
        profile: { ...base.profile, ...(saved.profile || {}) },
        transactions: Array.isArray(saved.transactions) ? saved.transactions : [],
        wallets: Array.isArray(saved.wallets) && saved.wallets.length
          ? saved.wallets : base.wallets,
        budgets: Array.isArray(saved.budgets) ? saved.budgets : [],
        goals: Array.isArray(saved.goals) ? saved.goals : [],
        loans: Array.isArray(saved.loans) ? saved.loans : [],
        bills: Array.isArray(saved.bills) ? saved.bills : []
      };
    }
  } catch (error) {
    console.warn("FINOVA could not read saved data.", error);
  }
  return freshData();
}

let data = loadData();
let selectedPlan = "monthly";
let toastTimer;

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    toast("Storage is full. Export a backup and remove large files.");
  }
}

function toast(message) {
  const element = $("toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("show"), 2800);
}

function isThisMonth(transaction) {
  return monthKey(transaction.date) === monthKey(today());
}

function totals(list = data.transactions) {
  return list.reduce((result, transaction) => {
    const amount = Number(transaction.amount) || 0;
    if (transaction.type === "income") result.income += amount;
    else result.expenses += amount;
    return result;
  }, { income: 0, expenses: 0 });
}

function totalBalance() {
  return data.wallets.reduce((sum, wallet) => sum + Number(wallet.balance || 0), 0);
}

function categoryExpenses(category, currentMonth = false) {
  return data.transactions
    .filter(transaction =>
      transaction.type === "expense" &&
      (!category || transaction.category === category) &&
      (!currentMonth || isThisMonth(transaction))
    )
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
}

function categoryOptions(selected = "Food", includeSalary = true) {
  return CATEGORIES
    .filter(category => includeSalary || category !== "Salary")
    .map(category =>
      `<option value="${escapeHTML(category)}" ${category === selected ? "selected" : ""}>${escapeHTML(category)}</option>`
    ).join("");
}

function walletOptions(selected = "") {
  return data.wallets.map(wallet =>
    `<option value="${escapeHTML(wallet.id)}" ${wallet.id === selected ? "selected" : ""}>${escapeHTML(wallet.name)}</option>`
  ).join("");
}

function showPage(name) {
  const target = $("page-" + name);
  if (!target) return;

  document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
  target.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(button =>
    button.classList.toggle("active", button.dataset.page === name)
  );
  document.querySelectorAll(".mobile-nav button").forEach(button =>
    button.classList.toggle("active", button.dataset.page === name)
  );

  closeSidebar();
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (name === "analytics") renderAnalytics();
}

function openSidebar() {
  $("sidebar").classList.add("open");
  $("backdrop").classList.add("open");
}

function closeSidebar() {
  $("sidebar").classList.remove("open");
  $("backdrop").classList.remove("open");
}

function openModal(title, html) {
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = html;
  $("modalBackdrop").classList.add("open");
}

function closeModal() {
  $("modalBackdrop").classList.remove("open");
}

function field(label, fieldId, placeholder, type = "text", value = "", required = true) {
  return `
    <div class="field">
      <label for="${fieldId}">${label}</label>
      <input class="control" id="${fieldId}" type="${type}"
        placeholder="${placeholder}" value="${escapeHTML(value)}"
        ${required ? "required" : ""}
        ${type === "number" ? 'min="0" step="0.01"' : ""}>
    </div>`;
}

function deleteButton(type, recordId) {
  return `<button type="button" class="btn small danger" data-delete="${type}" data-id="${escapeHTML(recordId)}">Delete</button>`;
}

function listRow(name, subtitle, amount, type = "", icon = "•", extra = "") {
  return `
    <div class="list-row">
      <div class="row-icon">${icon}</div>
      <div class="row-main">
        <b>${escapeHTML(name)}</b>
        <small>${escapeHTML(subtitle)}</small>
      </div>
      <div class="row-end ${type === "income" ? "positive" : type === "expense" ? "negative" : ""}">
        ${amount}
        ${extra ? `<div class="row-actions">${extra}</div>` : ""}
      </div>
    </div>`;
}

/* TRANSACTIONS */

function openTransaction(transactionId = "") {
  const existing = data.transactions.find(item => item.id === transactionId);

  openModal(existing ? "Edit transaction" : "New transaction", `
    <form id="transactionForm">
      <div class="form-grid">
        ${field("Description", "txName", "e.g. Groceries", "text", existing?.name || "")}
        <div class="field">
          <label for="txType">Transaction type</label>
          <select id="txType" class="control">
            <option value="expense" ${existing?.type !== "income" ? "selected" : ""}>Expense</option>
            <option value="income" ${existing?.type === "income" ? "selected" : ""}>Income</option>
          </select>
        </div>
        ${field("Amount (₹)", "txAmount", "0.00", "number", existing?.amount ?? "")}
        <div class="field">
          <label for="txCategory">Category</label>
          <select id="txCategory" class="control">${categoryOptions(existing?.category || "Food")}</select>
        </div>
        ${field("Date", "txDate", "", "date", existing?.date || today())}
        <div class="field">
          <label for="txWallet">Account</label>
          <select id="txWallet" class="control">${walletOptions(existing?.walletId || data.wallets[0]?.id)}</select>
        </div>
      </div>
      <button class="btn primary full" type="submit">${existing ? "Save changes" : "Save transaction"}</button>
    </form>
  `);

  $("transactionForm").addEventListener("submit", event => {
    event.preventDefault();

    const name = $("txName").value.trim();
    const amount = round($("txAmount").value);
    const type = $("txType").value;
    const walletId = $("txWallet").value;
    const wallet = data.wallets.find(item => item.id === walletId);

    if (!name || amount <= 0 || !wallet) {
      toast("Enter a description, positive amount and account.");
      return;
    }

    if (existing) {
      const oldWallet = data.wallets.find(item => item.id === existing.walletId);
      if (oldWallet) {
        oldWallet.balance = round(
          oldWallet.balance + (existing.type === "income" ? -existing.amount : existing.amount)
        );
      }
      data.transactions = data.transactions.filter(item => item.id !== existing.id);
    }

    const transaction = {
      id: existing?.id || id(),
      name,
      amount,
      type,
      category: $("txCategory").value,
      date: $("txDate").value || today(),
      walletId
    };

    data.transactions.unshift(transaction);
    wallet.balance = round(wallet.balance + (type === "income" ? amount : -amount));

    saveData();
    closeModal();
    renderAll();
    toast(existing ? "Transaction updated" : "Transaction saved");
  });
}

/* WALLETS AND VIRTUAL CARD DESIGNS */

function addWallet() {
  openModal("Add wallet or account", `
    <form id="walletForm">
      ${field("Account name", "walletName", "e.g. Savings Account")}
      <div class="field">
        <label for="walletType">Account type</label>
        <select id="walletType" class="control">
          <option>Bank Account</option><option>Savings</option>
          <option>Cash</option><option>UPI Wallet</option><option>Other</option>
        </select>
      </div>
      ${field("Opening balance (₹)", "walletBalance", "0.00", "number", "0")}
      <button class="btn primary full" type="submit">Create account</button>
    </form>
  `);

  $("walletForm").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("walletName").value.trim();
    const balance = round($("walletBalance").value);

    if (!name) return toast("Enter an account name.");

    data.wallets.push({
      id: id(),
      name,
      type: $("walletType").value,
      balance
    });

    saveData();
    closeModal();
    renderAll();
    toast("Account created");
  });
}

function renderWallets() {
  $("walletGrid").innerHTML = data.wallets.map((wallet, index) => {
    const digits = String(
      wallet.id.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0) * 73 % 10000
    ).padStart(4, "0");

    return `
      <article class="glass panel">
        <div class="card-visual ${index % 2 ? "violet" : ""}">
          <div class="card-top"><span>FINOVA</span><span>◉</span></div>
          <div class="card-number">•••• &nbsp; •••• &nbsp; •••• &nbsp; ${digits}</div>
          <div class="card-bottom">
            <div>${escapeHTML(wallet.name)}<b>${escapeHTML(wallet.type)}</b></div>
            <div style="text-align:right">BALANCE<b>${money(wallet.balance)}</b></div>
          </div>
        </div>
        <div class="account-details">
          <div><h3>${escapeHTML(wallet.name)}</h3><p class="muted">${escapeHTML(wallet.type)} · Virtual card design</p></div>
          ${wallet.id !== "main-wallet" ? deleteButton("wallet", wallet.id) : '<span class="chip">DEFAULT</span>'}
        </div>
      </article>`;
  }).join("");

  $("transferFrom").innerHTML = walletOptions();
  $("transferTo").innerHTML = walletOptions();

  const button = $("transferForm").querySelector('button[type="submit"]');
  button.disabled = data.wallets.length < 2;
}

/* BUDGETS AND SAVINGS GOALS */

function addBudget() {
  openModal("Create monthly budget", `
    <form id="budgetForm">
      ${field("Budget name", "budgetName", "e.g. Food budget")}
      <div class="field"><label for="budgetCategory">Category</label>
        <select class="control" id="budgetCategory">${categoryOptions("Food", false)}</select>
      </div>
      ${field("Monthly limit (₹)", "budgetLimit", "5000", "number")}
      <button class="btn primary full" type="submit">Save budget</button>
    </form>
  `);

  $("budgetForm").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("budgetName").value.trim();
    const limit = round($("budgetLimit").value);

    if (!name || limit <= 0) return toast("Enter a name and positive budget limit.");

    data.budgets.push({
      id: id(),
      name,
      category: $("budgetCategory").value,
      limit
    });

    saveData();
    closeModal();
    renderAll();
    toast("Budget created");
  });
}

function addGoal() {
  openModal("Create savings goal", `
    <form id="goalForm">
      ${field("Goal name", "goalName", "e.g. New laptop")}
      ${field("Target amount (₹)", "goalTarget", "20000", "number")}
      ${field("Already saved (₹)", "goalSaved", "0", "number", "0")}
      <button class="btn primary full" type="submit">Create goal</button>
    </form>
  `);

  $("goalForm").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("goalName").value.trim();
    const target = round($("goalTarget").value);
    const saved = round($("goalSaved").value);

    if (!name || target <= 0 || saved < 0) return toast("Enter a valid name and target.");

    data.goals.push({ id: id(), name, target, saved: Math.min(target, saved) });
    saveData();
    closeModal();
    renderAll();
    toast("Savings goal created");
  });
}

function renderBudgets() {
  $("budgetList").innerHTML = data.budgets.map(budget => {
    const spent = categoryExpenses(budget.category, true);
    const percent = Math.min(100, spent / budget.limit * 100);

    return `
      <div class="goal-card">
        <div class="goal-head"><b>${escapeHTML(budget.name)}</b><span class="chip ${percent >= 100 ? "red" : ""}">${Math.round(percent)}%</span></div>
        <p class="tiny">${escapeHTML(budget.category)} · ${money(spent)} of ${money(budget.limit)}</p>
        <div class="progress-track"><div class="progress-fill" style="--progress:${percent}%;${percent >= 100 ? "background:var(--red)" : ""}"></div></div>
        ${percent >= 100 ? '<p class="tiny negative">Budget limit reached or exceeded.</p>' : ""}
        <div class="row-actions">${deleteButton("budget", budget.id)}</div>
      </div>`;
  }).join("") || '<div class="empty-state">No budgets yet. Create a spending limit.</div>';

  $("goalList").innerHTML = data.goals.map(goal => {
    const percent = Math.min(100, goal.saved / goal.target * 100);

    return `
      <div class="goal-card">
        <div class="goal-head"><b>${escapeHTML(goal.name)}</b><span>${Math.round(percent)}%</span></div>
        <div class="goal-amount">${money(goal.saved)} <span class="tiny">/ ${money(goal.target)}</span></div>
        <div class="progress-track"><div class="progress-fill" style="--progress:${percent}%"></div></div>
        <div class="goal-foot"><span class="tiny">Savings progress</span><button class="btn small" data-contribute="${escapeHTML(goal.id)}">＋ Add savings</button></div>
        <div class="row-actions">${deleteButton("goal", goal.id)}</div>
      </div>`;
  }).join("") || '<div class="empty-state">No savings goals yet.</div>';
}

/* LOANS AND EMI */

function addLoan() {
  openModal("Add loan and calculate EMI", `
    <form id="loanForm">
      ${field("Loan name", "loanName", "e.g. Education loan")}
      <div class="form-grid">
        ${field("Principal (₹)", "loanPrincipalInput", "100000", "number")}
        ${field("Annual interest (%)", "loanRate", "8", "number", "8")}
        ${field("Term (months)", "loanMonths", "24", "number")}
      </div>
      <button class="btn primary full" type="submit">Calculate and save</button>
    </form>
  `);

  $("loanForm").addEventListener("submit", event => {
    event.preventDefault();

    const name = $("loanName").value.trim();
    const principal = round($("loanPrincipalInput").value);
    const rate = Number($("loanRate").value);
    const months = Math.floor(Number($("loanMonths").value));

    if (!name || principal <= 0 || rate < 0 || months <= 0) {
      return toast("Enter valid loan details.");
    }

    const monthlyRate = rate / 1200;
    const emi = monthlyRate === 0
      ? principal / months
      : principal * monthlyRate * Math.pow(1 + monthlyRate, months) /
        (Math.pow(1 + monthlyRate, months) - 1);

    data.loans.push({
      id: id(), name, principal, rate, months, paid: 0, emi: round(emi)
    });

    saveData();
    closeModal();
    renderAll();
    toast("Loan and estimated EMI saved");
  });
}

function renderLoans() {
  const principal = data.loans.reduce((sum, loan) => sum + loan.principal, 0);
  const outstanding = data.loans.reduce((sum, loan) => sum + Math.max(0, loan.principal - loan.paid), 0);

  $("loanPrincipal").textContent = money(principal);
  $("loanOutstanding").textContent = money(outstanding);

  $("loanList").innerHTML = data.loans.map(loan => {
    const remaining = Math.max(0, loan.principal - loan.paid);
    const percent = Math.min(100, loan.paid / loan.principal * 100);

    return `
      <article class="glass panel">
        <div class="stat-top"><span class="chip purple">LOAN</span><span class="tiny">${loan.months} months</span></div>
        <h2 style="margin-top:15px">${escapeHTML(loan.name)}</h2>
        <div class="stat-value">${money(remaining)}</div>
        <p class="muted">Outstanding of ${money(loan.principal)}</p>
        <div class="progress-track"><div class="progress-fill" style="--progress:${percent}%"></div></div>
        <div class="goal-foot"><span class="tiny">${Math.round(percent)}% repaid</span><span class="tiny">${loan.rate}% annual</span></div>
        <div class="info-row"><span class="muted">Estimated monthly EMI</span><b>${money(loan.emi)}</b></div>
        <div class="row-actions">
          <button class="btn small primary" data-repay="${escapeHTML(loan.id)}">＋ Record repayment</button>
          ${deleteButton("loan", loan.id)}
        </div>
      </article>`;
  }).join("") || '<div class="glass panel empty-state">No loans recorded yet. Add a loan to estimate its EMI.</div>';
}

/* BILLS AND RECURRING PAYMENTS */

function addBill() {
  openModal("Add bill or recurring payment", `
    <form id="billForm">
      ${field("Bill name", "billName", "e.g. Internet bill")}
      <div class="form-grid">
        ${field("Amount (₹)", "billAmount", "999", "number")}
        ${field("Next due date", "billDate", "", "date", today())}
      </div>
      <div class="field"><label for="billFrequency">Frequency</label>
        <select class="control" id="billFrequency">
          <option>One-time</option><option>Weekly</option><option selected>Monthly</option><option>Yearly</option>
        </select>
      </div>
      <button class="btn primary full" type="submit">Save bill</button>
    </form>
  `);

  $("billForm").addEventListener("submit", event => {
    event.preventDefault();

    const name = $("billName").value.trim();
    const amount = round($("billAmount").value);

    if (!name || amount <= 0) return toast("Enter a bill name and positive amount.");

    data.bills.push({
      id: id(),
      name,
      amount,
      date: $("billDate").value || today(),
      frequency: $("billFrequency").value,
      paid: false
    });

    saveData();
    closeModal();
    renderAll();
    toast("Bill saved");
  });
}

function renderBills() {
  const monthly = data.bills.reduce((sum, bill) => {
    const multiplier = {
      "Weekly": 4.33,
      "Yearly": 1 / 12,
      "One-time": 0,
      "Monthly": 1
    }[bill.frequency] ?? 1;
    return sum + bill.amount * multiplier;
  }, 0);

  $("monthlyBills").textContent = money(monthly);
  $("billCount").textContent = data.bills.length;

  $("billList").innerHTML = data.bills.slice().sort((a, b) => a.date.localeCompare(b.date)).map(bill =>
    listRow(
      bill.name,
      `${bill.frequency} · Due ${bill.date}`,
      money(bill.amount),
      "",
      bill.paid ? "✓" : "◷",
      `<button class="btn small" data-paid="${escapeHTML(bill.id)}">${bill.paid ? "Mark unpaid" : "Mark paid"}</button>${deleteButton("bill", bill.id)}`
    )
  ).join("") || '<div class="empty-state">No bills yet. Add your first recurring payment.</div>';
}

/* TRANSACTION TABLE */

function renderTransactions() {
  const monthTotals = totals(data.transactions.filter(isThisMonth));
  $("transactionIncome").textContent = money(monthTotals.income);
  $("transactionExpenses").textContent = money(monthTotals.expenses);

  const query = $("transactionSearch").value.trim().toLowerCase();
  const filter = $("transactionFilter").value;
  const sort = $("transactionSort").value;

  let transactions = data.transactions.filter(transaction =>
    (filter === "all" || transaction.type === filter) &&
    [transaction.name, transaction.category, transaction.date]
      .join(" ").toLowerCase().includes(query)
  );

  transactions.sort((a, b) => {
    if (sort === "oldest") return a.date.localeCompare(b.date);
    if (sort === "highest") return b.amount - a.amount;
    return b.date.localeCompare(a.date);
  });

  $("transactionTable").innerHTML = transactions.map(transaction => `
    <tr>
      <td><b>${escapeHTML(transaction.name)}</b><div class="tiny">${escapeHTML(data.wallets.find(w => w.id === transaction.walletId)?.name || "Account")}</div></td>
      <td>${escapeHTML(transaction.category)}</td>
      <td>${escapeHTML(transaction.date)}</td>
      <td class="${transaction.type === "income" ? "positive" : "negative"}">${transaction.type === "income" ? "+" : "−"}${money(transaction.amount)}</td>
      <td><div class="row-actions"><button class="btn small" data-edit-transaction="${escapeHTML(transaction.id)}">Edit</button>${deleteButton("transaction", transaction.id)}</div></td>
    </tr>
  `).join("");

  $("transactionEmpty").hidden = transactions.length > 0;
}

/* DASHBOARD */

function renderDashboard() {
  const monthTotals = totals(data.transactions.filter(isThisMonth));

  $("welcomeTitle").textContent = "Welcome" +
    (data.profile.name ? ", " + data.profile.name.split(" ")[0] : " to FINOVA") + ".";
  $("todayLabel").textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long"
  }).toUpperCase();

  $("totalBalance").textContent = money(totalBalance());
  $("monthIncome").textContent = money(monthTotals.income);
  $("monthExpenses").textContent = money(monthTotals.expenses);
  $("monthSavings").textContent = money(monthTotals.income - monthTotals.expenses);
  $("walletCount").textContent = data.wallets.length;
  $("avatar").textContent = (data.profile.name || "F").trim().charAt(0).toUpperCase() || "F";

  const categories = {};
  data.transactions.filter(t => t.type === "expense" && isThisMonth(t)).forEach(transaction => {
    categories[transaction.category] = (categories[transaction.category] || 0) + transaction.amount;
  });

  const sortedCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCategory = Math.max(1, ...sortedCategories.map(item => item[1]));

  $("dashboardCategories").innerHTML = sortedCategories.length
    ? sortedCategories.map(([name, amount]) => `
      <div class="bar-row">
        <span>${escapeHTML(name)}</span>
        <div class="bar-track"><div class="bar-fill" style="--progress:${amount / maxCategory * 100}%"></div></div>
        <span class="bar-amount">${money(amount)}</span>
      </div>`).join("")
    : '<div class="empty-state">Add expenses to see your spending breakdown.</div>';

  const recent = data.transactions.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  $("recentTransactions").innerHTML = recent.length
    ? recent.map(transaction => listRow(
      transaction.name,
      `${transaction.date} · ${transaction.category}`,
      `${transaction.type === "income" ? "+" : "−"}${money(transaction.amount)}`,
      transaction.type,
      transaction.type === "income" ? "↗" : "↘"
    )).join("")
    : '<div class="empty-state">Your recent transactions will appear here.</div>';

  $("dashboardGoals").innerHTML = data.goals.slice(0, 4).map(goal => {
    const percent = Math.min(100, goal.saved / goal.target * 100);
    return `
      <article class="glass panel">
        <div class="goal-head"><b>${escapeHTML(goal.name)}</b><span>${Math.round(percent)}%</span></div>
        <div class="goal-amount">${money(goal.saved)} <span class="tiny">/ ${money(goal.target)}</span></div>
        <div class="progress-track"><div class="progress-fill" style="--progress:${percent}%"></div></div>
      </article>`;
  }).join("") || `
    <article class="glass panel">
      <p class="muted">Create your first savings goal to track your progress here.</p>
      <button class="btn" data-action="add-goal">＋ Create a goal</button>
    </article>`;
}

/* ANALYTICS */

function renderAnalytics() {
  const all = totals();
  const monthly = totals(data.transactions.filter(isThisMonth));

  $("analyticsIncome").textContent = money(all.income);
  $("analyticsExpenses").textContent = money(all.expenses);
  $("analyticsNet").textContent = money(all.income - all.expenses);
  $("savingsRate").textContent = (monthly.income > 0
    ? Math.round((monthly.income - monthly.expenses) / monthly.income * 100)
    : 0) + "%";

  const months = [];

  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - i);

    months.push({
      key: date.toISOString().slice(0, 7),
      label: date.toLocaleDateString("en-IN", { month: "short" }),
      income: 0,
      expense: 0
    });
  }

  data.transactions.forEach(transaction => {
    const month = months.find(item => item.key === monthKey(transaction.date));
    if (month) month[transaction.type === "income" ? "income" : "expense"] += transaction.amount;
  });

  const maxAmount = Math.max(1, ...months.flatMap(month => [month.income, month.expense]));

  $("monthlyChart").innerHTML = months.map(month => `
    <div class="chart-month">
      <div class="chart-bars">
        <div class="chart-bar income" title="Income: ${money(month.income)}" style="height:${Math.max(2, month.income / maxAmount * 100)}%"></div>
        <div class="chart-bar expense" title="Expenses: ${money(month.expense)}" style="height:${Math.max(2, month.expense / maxAmount * 100)}%"></div>
      </div>
      <span class="tiny">${month.label}</span>
    </div>`).join("");

  const categories = {};
  data.transactions.filter(t => t.type === "expense").forEach(transaction => {
    categories[transaction.category] = (categories[transaction.category] || 0) + transaction.amount;
  });

  const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const max = Math.max(1, ...sorted.map(item => item[1]));

  $("analyticsCategories").innerHTML = sorted.map(([name, amount]) => `
    <div style="margin-top:16px">
      <div class="stat-top"><span>${escapeHTML(name)}</span><b>${money(amount)}</b></div>
      <div class="bar-track" style="margin-top:8px"><div class="bar-fill" style="--progress:${amount / max * 100}%"></div></div>
    </div>`).join("") || '<div class="empty-state">No expense data yet.</div>';

  const largest = sorted[0];
  $("insightText").textContent = largest
    ? `Your largest recorded spending category is ${largest[0]} at ${money(largest[1])}. This summary is based on the transactions entered in FINOVA.`
    : "Add transactions to generate useful spending summaries.";
}

function exportCSV() {
  const rows = [
    ["Date", "Description", "Type", "Category", "Amount INR", "Account"],
    ...data.transactions.map(transaction => [
      transaction.date,
      transaction.name,
      transaction.type,
      transaction.category,
      transaction.amount,
      data.wallets.find(wallet => wallet.id === transaction.walletId)?.name || "Unknown"
    ])
  ];

  const csv = rows.map(row =>
    row.map(value => '"' + String(value ?? "").replace(/"/g, '""') + '"').join(",")
  ).join("\r\n");

  downloadFile("finova-transactions.csv", csv, "text/csv;charset=utf-8");
  toast("CSV report exported");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* PRO PAGE */

function updatePlan(plan) {
  selectedPlan = plan;

  $("planPrice").innerHTML = plan === "monthly"
    ? '₹99 <span>/ month</span>'
    : '₹1,000 <span>/ year</span>';

  $("monthlyPlan").classList.toggle("primary", plan === "monthly");
  $("yearlyPlan").classList.toggle("primary", plan === "yearly");
}

$("monthlyPlan").addEventListener("click", () => updatePlan("monthly"));
$("yearlyPlan").addEventListener("click", () => updatePlan("yearly"));

$("subscribeBtn").addEventListener("click", () => {
  toast("Demo only: connect a verified payment provider before accepting subscriptions.");
});

/* RECEIPT UPLOAD */

$("receiptCategory").innerHTML = categoryOptions("Food", false);

$("receiptFile").addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    toast("Choose an image file.");
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    toast("Choose an image smaller than 8 MB.");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    $("receiptPreview").src = reader.result;
    $("receiptPreview").hidden = false;
  };

  reader.readAsDataURL(file);
});

$("receiptForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("receiptName").value.trim();
  const amount = round($("receiptAmount").value);
  const wallet = data.wallets[0];

  if (!name || amount <= 0 || !wallet) {
    toast("Enter a description, positive amount and account.");
    return;
  }

  data.transactions.unshift({
    id: id(),
    name,
    amount,
    type: "expense",
    category: $("receiptCategory").value,
    date: today(),
    walletId: wallet.id
  });

  wallet.balance = round(wallet.balance - amount);

  saveData();
  renderAll();
  $("receiptForm").reset();
  $("receiptPreview").hidden = true;
  toast("Expense saved from receipt details");
});

/* TRANSFERS */

$("transferForm").addEventListener("submit", event => {
  event.preventDefault();

  const fromId = $("transferFrom").value;
  const toId = $("transferTo").value;
  const amount = round($("transferAmount").value);

  if (fromId === toId) return toast("Choose two different accounts.");
  if (amount <= 0) return toast("Enter a positive amount.");

  const from = data.wallets.find(wallet => wallet.id === fromId);
  const to = data.wallets.find(wallet => wallet.id === toId);

  if (!from || !to) return toast("Choose both accounts.");

  if (from.balance < amount &&
      !confirm("This transfer exceeds the recorded source balance. Record it anyway?")) {
    return;
  }

  from.balance = round(from.balance - amount);
  to.balance = round(to.balance + amount);

  saveData();
  renderAll();
  $("transferAmount").value = "";
  toast("Transfer recorded");
});

/* PROFILE AND BACKUP */

$("profileForm").addEventListener("submit", event => {
  event.preventDefault();

  data.profile.name = $("profileName").value.trim();
  data.profile.age = $("profileAge").value;

  saveData();
  renderAll();
  toast("Profile saved");
});

$("backupBtn").addEventListener("click", () => {
  downloadFile("finova-backup.json", JSON.stringify(data, null, 2), "application/json");
});

$("restoreBtn").addEventListener("click", () => {
  const file = $("restoreFile").files?.[0];
  if (!file) return toast("Choose a JSON backup first.");

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const backup = JSON.parse(reader.result);

      if (!backup || !Array.isArray(backup.wallets) ||
          !Array.isArray(backup.transactions)) {
        throw new Error("Invalid backup");
      }

      if (!confirm("Replace your current FINOVA data with this backup?")) return;

      const base = freshData();
      data = {
        ...base,
        ...backup,
        profile: { ...base.profile, ...(backup.profile || {}) },
        wallets: backup.wallets.length ? backup.wallets : base.wallets,
        transactions: backup.transactions,
        budgets: Array.isArray(backup.budgets) ? backup.budgets : [],
        goals: Array.isArray(backup.goals) ? backup.goals : [],
        loans: Array.isArray(backup.loans) ? backup.loans : [],
        bills: Array.isArray(backup.bills) ? backup.bills : []
      };

      saveData();
      renderAll();
      toast("Backup restored");
    } catch (error) {
      toast("That file is not a valid FINOVA backup.");
    }
  };

  reader.readAsText(file);
});

$("resetBtn").addEventListener("click", () => {
  if (!confirm("Permanently clear all FINOVA data saved in this browser? Download a backup first if needed.")) return;

  data = freshData();
  saveData();
  renderAll();
  $("onboarding").classList.add("show");
  toast("App data reset");
});

/* SAVINGS CONTRIBUTIONS AND LOAN REPAYMENTS */

function contributeToGoal(goalId) {
  const goal = data.goals.find(item => item.id === goalId);
  if (!goal) return;

  const input = prompt("How much did you save? (₹)");
  if (input === null) return;

  const amount = round(input);
  if (amount <= 0) return toast("Enter a positive amount.");

  goal.saved = Math.min(goal.target, round(goal.saved + amount));

  saveData();
  renderAll();
  toast("Goal progress updated");
}

function recordRepayment(loanId) {
  const loan = data.loans.find(item => item.id === loanId);
  if (!loan) return;

  const input = prompt("Enter repayment amount (₹):", String(loan.emi));
  if (input === null) return;

  const amount = round(input);
  if (amount <= 0) return toast("Enter a positive amount.");

  loan.paid = Math.min(loan.principal, round(loan.paid + amount));

  saveData();
  renderAll();
  toast("Repayment recorded in your loan tracker");
}

/* DELETE RECORDS */

function deleteRecord(type, recordId) {
  if (!confirm("Delete this record? This cannot be undone.")) return;

  if (type === "transaction") {
    const transaction = data.transactions.find(item => item.id === recordId);

    if (transaction) {
      const wallet = data.wallets.find(item => item.id === transaction.walletId);

      if (wallet) {
        wallet.balance = round(
          wallet.balance - (transaction.type === "income"
            ? transaction.amount : -transaction.amount)
        );
      }
    }

    data.transactions = data.transactions.filter(item => item.id !== recordId);
  } else if (type === "wallet") {
    if (data.transactions.some(item => item.walletId === recordId)) {
      return toast("This account has transactions. Keep it to preserve your history.");
    }
    if (data.wallets.length <= 1) return toast("Keep at least one account.");

    data.wallets = data.wallets.filter(item => item.id !== recordId);
  } else {
    const keys = {
      budget: "budgets",
      goal: "goals",
      loan: "loans",
      bill: "bills"
    };

    const key = keys[type];
    if (!key) return;

    data[key] = data[key].filter(item => item.id !== recordId);
  }

  saveData();
  renderAll();
  toast("Record deleted");
}

/* ONBOARDING */

$("onboardForm").addEventListener("submit", event => {
  event.preventDefault();

  data.profile.name = $("userName").value.trim();
  data.profile.age = $("userAge").value;
  data.onboarded = true;

  saveData();
  $("onboarding").classList.remove("show");
  renderAll();
  toast("Welcome to FINOVA" + (data.profile.name ? ", " + data.profile.name : "") + "!");
});

/* NAVIGATION AND ACTION HANDLERS */

function performAction(action) {
  const actions = {
    "add-transaction": () => openTransaction(),
    "add-wallet": addWallet,
    "add-budget": addBudget,
    "add-goal": addGoal,
    "add-loan": addLoan,
    "add-bill": addBill
  };

  if (actions[action]) actions[action]();
}

document.addEventListener("click", event => {
  const pageButton = event.target.closest("[data-page]");
  if (pageButton) {
    showPage(pageButton.dataset.page);
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    performAction(actionButton.dataset.action);
    return;
  }

  const editButton = event.target.closest("[data-edit-transaction]");
  if (editButton) {
    openTransaction(editButton.dataset.editTransaction);
    return;
  }

  const deleteButtonElement = event.target.closest("[data-delete]");
  if (deleteButtonElement) {
    deleteRecord(deleteButtonElement.dataset.delete, deleteButtonElement.dataset.id);
    return;
  }

  const contributionButton = event.target.closest("[data-contribute]");
  if (contributionButton) {
    contributeToGoal(contributionButton.dataset.contribute);
    return;
  }

  const repaymentButton = event.target.closest("[data-repay]");
  if (repaymentButton) {
    recordRepayment(repaymentButton.dataset.repay);
    return;
  }

  const paidButton = event.target.closest("[data-paid]");
  if (paidButton) {
    const bill = data.bills.find(item => item.id === paidButton.dataset.paid);

    if (bill) {
      bill.paid = !bill.paid;
      saveData();
      renderAll();
      toast(bill.paid ? "Bill marked paid" : "Bill marked unpaid");
    }
  }
});

$("menuBtn").addEventListener("click", () => {
  $("sidebar").classList.contains("open") ? closeSidebar() : openSidebar();
});

$("backdrop").addEventListener("click", closeSidebar);
$("quickAdd").addEventListener("click", () => openTransaction());
$("closeModal").addEventListener("click", closeModal);

$("modalBackdrop").addEventListener("click", event => {
  if (event.target === $("modalBackdrop")) closeModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeModal();
    closeSidebar();
  }
});

$("transactionSearch").addEventListener("input", renderTransactions);
$("transactionFilter").addEventListener("change", renderTransactions);
$("transactionSort").addEventListener("change", renderTransactions);
$("exportCSV").addEventListener("click", exportCSV);

/* REFRESH ALL APP SCREENS */

function renderAll() {
  renderDashboard();
  renderTransactions();
  renderWallets();
  renderBudgets();
  renderLoans();
  renderBills();
  renderAnalytics();

  $("profileName").value = data.profile.name || "";
  $("profileAge").value = data.profile.age || "";
}

function startApp() {
  updatePlan("monthly");
  renderAll();

  if (!data.onboarded) {
    $("onboarding").classList.add("show");
  }
}

startApp();
