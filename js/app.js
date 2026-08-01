/**
 * Finance Tracker Pro - Main Application
 */

let currentPeriod = 'current';
let currentPartyType = 'debtor';
let editingId = null;
let editingStore = null;

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await openDB();
    initNavigation();
    initDashboard();
    initIncome();
    initExpenses();
    initBudget();
    initParties();
    initSavings();
    initGoals();
    initPlanning();
    initModals();
    updateMobileDate();
    refreshAll();
  } catch (err) {
    console.error('Init error:', err);
    showToast('Failed to initialize app', 'error');
  }
});

// ============================================
// NAVIGATION
// ============================================

function initNavigation() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const menuBtn = document.getElementById('menuBtn');
  const toggleBtn = document.getElementById('sidebarToggle');

  // Page navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      navigateTo(page);
      if (window.innerWidth <= 768) {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
      }
    });
  });

  // Mobile menu
  menuBtn.addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.classList.add('show');
  });

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  });

  // Desktop collapse
  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });

  // Period selector
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.dataset.period;
      refreshDashboard();
    });
  });
}

function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const navItem = document.querySelector(`[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');

  if (page === 'dashboard') refreshDashboard();
  if (page === 'income') renderIncome();
  if (page === 'expenses') renderExpenses();
  if (page === 'budget') renderBudget();
  if (page === 'debtors-creditors') renderParties();
  if (page === 'savings') renderSavings();
  if (page === 'goals') renderGoals();
  if (page === 'planning') renderPlanning();
}

// ============================================
// DASHBOARD
// ============================================

function initDashboard() {}

async function refreshAll() {
  await refreshDashboard();
}

async function refreshDashboard() {
  const { from, to } = getMonthRange(currentPeriod);

  const allIncome = await getAllRecords('income');
  const allExpenses = await getAllRecords('expenses');

  // Filter by period
  const income = allIncome.filter(i => i.date >= from && i.date <= to);
  const expenses = allExpenses.filter(e => e.date >= from && e.date <= to);

  const totalIncome = income.reduce((sum, i) => sum + Number(i.amount), 0);
  const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const netIncome = totalIncome - totalExpense;

  document.getElementById('statNetIncome').textContent = formatCurrency(netIncome);
  document.getElementById('statTotalIncome').textContent = formatCurrency(totalIncome);
  document.getElementById('statTotalExpense').textContent = formatCurrency(totalExpense);

  // Net income color
  const netEl = document.getElementById('statNetIncome');
  netEl.style.color = netIncome >= 0 ? 'var(--success)' : 'var(--danger)';

  // Change indicators
  if (currentPeriod === 'current') {
    const lastRange = getMonthRange('last');
    const lastIncome = allIncome.filter(i => i.date >= lastRange.from && i.date <= lastRange.to)
      .reduce((s, i) => s + Number(i.amount), 0);
    const lastExpense = allExpenses.filter(e => e.date >= lastRange.from && e.date <= lastRange.to)
      .reduce((s, e) => s + Number(e.amount), 0);

    document.getElementById('statIncomeChange').textContent =
      lastIncome ? `${((totalIncome - lastIncome) / lastIncome * 100).toFixed(1)}% vs last month` : '—';
    document.getElementById('statExpenseChange').textContent =
      lastExpense ? `${((totalExpense - lastExpense) / lastExpense * 100).toFixed(1)}% vs last month` : '—';
  }

  // Savings
  const monthKey = getCurrentMonthKey();
  const savedThisMonth = totalIncome - totalExpense;
  const savingsGoal = await getRecord('savingsGoals', 1);
  const goalAmount = savingsGoal ? savingsGoal.monthlyTarget : 0;

  document.getElementById('statSavings').textContent = formatCurrency(Math.max(0, savedThisMonth));
  document.getElementById('statSavingsTarget').textContent = formatCurrency(goalAmount);

  // Income breakdown
  const incomeBySource = {};
  income.forEach(i => {
    incomeBySource[i.source] = (incomeBySource[i.source] || 0) + Number(i.amount);
  });
  const incBreakdown = document.getElementById('incomeBreakdown');
  incBreakdown.innerHTML = Object.entries(incomeBySource)
    .sort((a, b) => b[1] - a[1])
    .map(([src, amt]) => `<div class="breakdown-item">
      <span class="breakdown-label">${src}</span>
      <span class="breakdown-amount" style="color:var(--success)">${formatCurrency(amt)}</span>
    </div>`).join('') || '<div class="empty-state">No income this period</div>';

  // Expense breakdown
  const expenseByCat = {};
  expenses.forEach(e => {
    expenseByCat[e.category] = (expenseByCat[e.category] || 0) + Number(e.amount);
  });
  const expBreakdown = document.getElementById('expenseBreakdown');
  expBreakdown.innerHTML = Object.entries(expenseByCat)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `<div class="breakdown-item">
      <span class="breakdown-label">${cat}</span>
      <span class="breakdown-amount" style="color:var(--danger)">${formatCurrency(amt)}</span>
    </div>`).join('') || '<div class="empty-state">No expenses this period</div>';

  // Budget alerts
  renderBudgetAlerts(expenseByCat);
}

async function renderBudgetAlerts(expenseByCat) {
  const budgets = await getAllRecords('budgets');
  const alerts = [];

  for (const budget of budgets) {
    const spent = expenseByCat[budget.category] || 0;
    const pct = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
    if (pct >= 90) {
      alerts.push({
        type: pct >= 100 ? 'danger' : 'warning',
        icon: pct >= 100 ? 'fa-circle-exclamation' : 'fa-triangle-exclamation',
        msg: `${budget.category}: Spent ${formatCurrency(spent)} of ${formatCurrency(budget.amount)} (${pct.toFixed(0)}%) — ${pct >= 100 ? 'OVER BUDGET!' : 'Almost at limit!'}`
      });
    }
  }

  const alertsEl = document.getElementById('budgetAlerts');
  alertsEl.innerHTML = alerts.map(a =>
    `<div class="alert alert-${a.type}">
      <i class="fa-solid ${a.icon}"></i>
      <span>${a.msg}</span>
    </div>`
  ).join('');
}

// ============================================
// INCOME
// ============================================

function initIncome() {
  document.getElementById('btnAddIncome').addEventListener('click', () => openModal('income'));
}

async function renderIncome() {
  const records = await getAllRecords('income');
  records.sort((a, b) => new Date(b.date) - new Date(a.date));
  const tbody = document.getElementById('incomeTableBody');
  const empty = document.getElementById('incomeEmpty');

  if (records.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  tbody.innerHTML = records.map(r => `
    <tr>
      <td><strong>${r.source}</strong></td>
      <td style="color:var(--success);font-weight:600">${formatCurrency(r.amount)}</td>
      <td>${formatDate(r.date)}</td>
      <td><span class="badge badge-info">${r.category || 'General'}</span></td>
      <td>${r.note || '—'}</td>
      <td>
        <button class="btn-icon edit" onclick="editRecord('income', ${r.id})" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
        <button class="btn-icon delete" onclick="deleteAndRefresh('income', ${r.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

// ============================================
// EXPENSES
// ============================================

function initExpenses() {
  document.getElementById('btnAddExpense').addEventListener('click', () => openModal('expense'));
}

async function renderExpenses() {
  const records = await getAllRecords('expenses');
  records.sort((a, b) => new Date(b.date) - new Date(a.date));
  const tbody = document.getElementById('expenseTableBody');
  const empty = document.getElementById('expenseEmpty');

  if (records.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  tbody.innerHTML = records.map(r => `
    <tr>
      <td><strong>${r.category}</strong></td>
      <td style="color:var(--danger);font-weight:600">${formatCurrency(r.amount)}</td>
      <td>${formatDate(r.date)}</td>
      <td><span class="badge ${r.type === 'Personal' ? 'badge-warning' : 'badge-info'}">${r.type || 'Business'}</span></td>
      <td>${r.note || '—'}</td>
      <td>
        <button class="btn-icon edit" onclick="editRecord('expenses', ${r.id})" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
        <button class="btn-icon delete" onclick="deleteAndRefresh('expenses', ${r.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

// ============================================
// BUDGET
// ============================================

function initBudget() {
  document.getElementById('btnSetBudget').addEventListener('click', () => openModal('budget'));
}

async function renderBudget() {
  const budgets = await getAllRecords('budgets');
  const { from, to } = getMonthRange('current');
  const allExpenses = await getAllRecords('expenses');
  const expenses = allExpenses.filter(e => e.date >= from && e.date <= to);

  const expenseByCat = {};
  expenses.forEach(e => {
    expenseByCat[e.category] = (expenseByCat[e.category] || 0) + Number(e.amount);
  });

  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = Object.values(expenseByCat).reduce((s, v) => s + v, 0);
  const totalRemaining = totalBudget - totalSpent;
  const budgetPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  document.getElementById('totalBudget').textContent = formatCurrency(totalBudget);
  document.getElementById('totalSpent').textContent = formatCurrency(totalSpent);
  document.getElementById('totalRemaining').textContent = formatCurrency(totalRemaining);
  document.getElementById('budgetPercent').textContent = Math.min(budgetPct, 100).toFixed(0) + '%';

  // Ring
  const ring = document.getElementById('budgetRing');
  const circumference = 326.73;
  const offset = circumference - (Math.min(budgetPct, 100) / 100) * circumference;
  ring.style.strokeDashoffset = offset;
  ring.style.stroke = budgetPct > 100 ? 'var(--danger)' : budgetPct > 80 ? 'var(--warning)' : 'var(--accent)';

  // Category cards
  const categoriesEl = document.getElementById('budgetCategories');
  categoriesEl.innerHTML = budgets.map(b => {
    const spent = expenseByCat[b.category] || 0;
    const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
    const overClass = pct >= 100 ? 'over' : '';
    const fillClass = pct > 100 ? 'danger' : pct > 80 ? 'warning' : 'safe';

    return `
      <div class="budget-cat-card ${overClass}">
        <div class="cat-header">
          <span class="cat-name">${b.category}</span>
          <span class="cat-status ${overClass}">${pct.toFixed(0)}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${fillClass}" style="width:${Math.min(pct, 100)}%"></div>
        </div>
        <div class="cat-numbers">
          <span>Spent: <strong style="color:${pct >= 100 ? 'var(--danger)' : 'inherit'}">${formatCurrency(spent)}</strong></span>
          <span>Budget: <strong>${formatCurrency(b.amount)}</strong></span>
          <span>Left: <strong style="color:${pct >= 100 ? 'var(--danger)' : 'var(--success)'}">${formatCurrency(Math.max(0, b.amount - spent))}</strong></span>
        </div>
      </div>
    `;
  }).join('') || '<div class="empty-state">No budget categories set. Click "Set Budget" to begin.</div>';
}

// ============================================
// DEBTORS & CREDITORS
// ============================================

function initParties() {
  document.getElementById('btnAddParty').addEventListener('click', () => openModal('party'));

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentPartyType = tab.dataset.tab;
      renderParties();
    });
  });
}

async function renderParties() {
  const records = (await getAllRecords('parties')).filter(p => p.type === currentPartyType);
  records.sort((a, b) => new Date(b.date) - new Date(a.date));
  const tbody = document.getElementById('partyTableBody');
  const empty = document.getElementById('partyEmpty');

  if (records.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  const now = new Date();
  tbody.innerHTML = records.map(r => {
    const overdue = new Date(r.dueDate) < now && r.status !== 'Paid';
    return `
      <tr>
        <td><strong>${r.name}</strong></td>
        <td style="font-weight:600;color:${r.type === 'debtor' ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(r.amount)}</td>
        <td>${formatDate(r.date)}</td>
        <td>${formatDate(r.dueDate)}</td>
        <td>
          <span class="badge ${r.status === 'Paid' ? 'badge-success' : overdue ? 'badge-danger' : 'badge-warning'}">
            ${r.status}${overdue ? ' (Overdue)' : ''}
          </span>
        </td>
        <td>${r.note || '—'}</td>
        <td>
          <button class="btn-icon edit" onclick="editRecord('parties', ${r.id})" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
          ${r.status !== 'Paid' ? `<button class="btn-icon" onclick="markPartyPaid(${r.id})" title="Mark Paid" style="color:var(--success)"><i class="fa-solid fa-check-circle"></i></button>` : ''}
          <button class="btn-icon delete" onclick="deleteAndRefresh('parties', ${r.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

async function markPartyPaid(id) {
  const record = await getRecord('parties', id);
  record.status = 'Paid';
  record.paidDate = new Date().toISOString().split('T')[0];
  await updateRecord('parties', record);
  renderParties();
  showToast('Marked as paid', 'success');
}

// ============================================
// SAVINGS
// ============================================

function initSavings() {
  document.getElementById('btnSetSavingsGoal').addEventListener('click', () => openModal('savingsGoal'));
}

async function renderSavings() {
  const goal = await getRecord('savingsGoals', 1);
  const history = await getAllRecords('savingsHistory');
  history.sort((a, b) => b.month.localeCompare(a.month));

  const badge = document.getElementById('savingsGoalBadge');
  const goalAmount = goal ? goal.monthlyTarget : 0;

  if (goalAmount > 0) {
    badge.textContent = formatCurrency(goalAmount) + '/mo';
    badge.className = 'goal-badge set';
  } else {
    badge.textContent = 'Not Set';
    badge.className = 'goal-badge not-set';
  }

  document.getElementById('savingsGoalAmount').textContent = formatCurrency(goalAmount);

  // Calculate current month savings
  const { from, to } = getMonthRange('current');
  const allIncome = await getAllRecords('income');
  const allExpenses = await getAllRecords('expenses');
  const income = allIncome.filter(i => i.date >= from && i.date <= to).reduce((s, i) => s + Number(i.amount), 0);
  const expenses = allExpenses.filter(e => e.date >= from && e.date <= to).reduce((s, e) => s + Number(e.amount), 0);
  const saved = Math.max(0, income - expenses);

  document.getElementById('savingsSaved').textContent = formatCurrency(saved);
  const pct = goalAmount > 0 ? (saved / goalAmount) * 100 : 0;
  const fill = document.getElementById('savingsProgressFill');
  fill.style.width = Math.min(pct, 100) + '%';
  fill.className = 'progress-fill ' + (pct >= 100 ? 'safe' : pct >= 50 ? 'warning' : 'danger');

  // History table
  const tbody = document.getElementById('savingsTableBody');
  tbody.innerHTML = history.map(h => `
    <tr>
      <td><strong>${h.month}</strong></td>
      <td>${formatCurrency(h.target)}</td>
      <td style="color:var(--success)">${formatCurrency(h.saved)}</td>
      <td style="color:${h.shortfall > 0 ? 'var(--danger)' : 'var(--success)'}">${formatCurrency(h.shortfall)}</td>
      <td><span class="badge ${h.shortfall <= 0 ? 'badge-success' : 'badge-danger'}">${h.shortfall <= 0 ? 'Achieved' : 'Missed'}</span></td>
    </tr>
  `).join('') || '<tr><td colspan="5" class="empty-state">No savings history yet</td></tr>';
}

// ============================================
// GOALS
// ============================================

function initGoals() {
  document.getElementById('btnAddGoal').addEventListener('click', () => openModal('goal'));
}

async function renderGoals() {
  const goals = await getAllRecords('goals');
  const grid = document.getElementById('goalsGrid');
  const empty = document.getElementById('goalsEmpty');

  if (goals.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  grid.innerHTML = goals.map(g => `
    <div class="goal-card">
      <div class="goal-header-row">
        <span class="goal-title">${g.title}</span>
        <span class="badge badge-info">${g.category || 'General'}</span>
      </div>
      <div class="goal-target">${formatCurrency(g.targetAmount)}</div>
      <div class="goal-desc">${g.description || 'No description'}</div>
      <div class="goal-meta" style="font-size:0.8em;color:var(--text-muted);margin-bottom:12px">
        Deadline: ${formatDate(g.deadline) || 'N/A'}
      </div>
      <div class="goal-actions">
        <button class="btn btn-secondary btn-sm" onclick="editRecord('goals', ${g.id})"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
        <button class="btn-icon delete" onclick="deleteAndRefresh('goals', ${g.id})" title="Delete" style="background:rgba(239,68,68,0.1);color:var(--danger)"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

// ============================================
// NEXT MONTH PLANNING
// ============================================

function initPlanning() {
  document.getElementById('btnSaveIncomeTarget').addEventListener('click', savePlanField);
  document.getElementById('btnSaveExpenseLimit').addEventListener('click', savePlanField);
  document.getElementById('btnSaveSavingsTarget').addEventListener('click', savePlanField);
  document.getElementById('btnSavePlanNotes').addEventListener('click', savePlanField);
}

async function renderPlanning() {
  const nextMonth = getNextMonthKey();
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  const monthName = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  document.getElementById('nextMonthLabel').textContent = `Planning for ${monthName} (${nextMonth})`;

  const plan = await getRecord('planning', nextMonth) || {};

  document.getElementById('planIncomeTarget').value = plan.incomeTarget || '';
  document.getElementById('planExpenseLimit').value = plan.expenseLimit || '';
  document.getElementById('planSavingsTarget').value = plan.savingsTarget || '';
  document.getElementById('planNotes').value = plan.notes || '';

  document.getElementById('planIncomeCurrent').textContent = plan.incomeTarget ? `Target set: ${formatCurrency(plan.incomeTarget)}` : '';
  document.getElementById('planExpenseCurrent').textContent = plan.expenseLimit ? `Limit set: ${formatCurrency(plan.expenseLimit)}` : '';
  document.getElementById('planSavingsCurrent').textContent = plan.savingsTarget ? `Target set: ${formatCurrency(plan.savingsTarget)}` : '';
}

async function savePlanField() {
  const nextMonth = getNextMonthKey();
  let plan = await getRecord('planning', nextMonth) || { month: nextMonth };

  plan.incomeTarget = Number(document.getElementById('planIncomeTarget').value) || 0;
  plan.expenseLimit = Number(document.getElementById('planExpenseLimit').value) || 0;
  plan.savingsTarget = Number(document.getElementById('planSavingsTarget').value) || 0;
  plan.notes = document.getElementById('planNotes').value;

  await updateRecord('planning', plan);
  renderPlanning();
  showToast('Plan saved!', 'success');
}

// ============================================
// MODAL
// ============================================

function initModals() {
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
}

function openModal(type, data = null) {
  const modal = document.getElementById('modalOverlay');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');
  const saveBtn = document.getElementById('modalSave');

  editingId = data ? data.id : null;
  editingStore = null;

  switch (type) {
    case 'income':
      title.textContent = data ? 'Edit Income' : 'Add Income';
      editingStore = 'income';
      body.innerHTML = `
        <div class="form-group">
          <label>Income Source *</label>
          <input type="text" id="formSource" class="input" placeholder="e.g., Salary, Freelance, Business" value="${data ? data.source : ''}">
        </div>
        <div class="form-group">
          <label>Amount (₹) *</label>
          <input type="number" id="formAmount" class="input" placeholder="Enter amount" value="${data ? data.amount : ''}">
        </div>
        <div class="form-group">
          <label>Date *</label>
          <input type="date" id="formDate" class="input" value="${data ? data.date : new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label>Category</label>
          <select id="formCategory" class="input">
            <option value="Salary" ${data && data.category === 'Salary' ? 'selected' : ''}>Salary</option>
            <option value="Business" ${data && data.category === 'Business' ? 'selected' : ''}>Business</option>
            <option value="Freelance" ${data && data.category === 'Freelance' ? 'selected' : ''}>Freelance</option>
            <option value="Investment" ${data && data.category === 'Investment' ? 'selected' : ''}>Investment</option>
            <option value="Rental" ${data && data.category === 'Rental' ? 'selected' : ''}>Rental</option>
            <option value="Other" ${data && data.category === 'Other' ? 'selected' : ''}>Other</option>
          </select>
        </div>
        <div class="form-group">
          <label>Note (Optional)</label>
          <input type="text" id="formNote" class="input" placeholder="Any note..." value="${data ? data.note || '' : ''}">
        </div>
      `;
      break;

    case 'expense':
      title.textContent = data ? 'Edit Expense' : 'Add Expense';
      editingStore = 'expenses';
      body.innerHTML = `
        <div class="form-group">
          <label>Category *</label>
          <select id="formCategory" class="input">
            <option value="Food" ${data && data.category === 'Food' ? 'selected' : ''}>Food</option>
            <option value="Transport" ${data && data.category === 'Transport' ? 'selected' : ''}>Transport</option>
            <option value="Rent" ${data && data.category === 'Rent' ? 'selected' : ''}>Rent</option>
            <option value="Utilities" ${data && data.category === 'Utilities' ? 'selected' : ''}>Utilities</option>
            <option value="Entertainment" ${data && data.category === 'Entertainment' ? 'selected' : ''}>Entertainment</option>
            <option value="Shopping" ${data && data.category === 'Shopping' ? 'selected' : ''}>Shopping</option>
            <option value="Healthcare" ${data && data.category === 'Healthcare' ? 'selected' : ''}>Healthcare</option>
            <option value="Education" ${data && data.category === 'Education' ? 'selected' : ''}>Education</option>
            <option value="EMI/Loan" ${data && data.category === 'EMI/Loan' ? 'selected' : ''}>EMI/Loan</option>
            <option value="Investment" ${data && data.category === 'Investment' ? 'selected' : ''}>Investment</option>
            <option value="Other" ${data && data.category === 'Other' ? 'selected' : ''}>Other</option>
          </select>
        </div>
        <div class="form-group">
          <label>Amount (₹) *</label>
          <input type="number" id="formAmount" class="input" placeholder="Enter amount" value="${data ? data.amount : ''}">
        </div>
        <div class="form-group">
          <label>Date *</label>
          <input type="date" id="formDate" class="input" value="${data ? data.date : new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label>Type</label>
          <select id="formType" class="input">
            <option value="Business" ${data && data.type === 'Business' ? 'selected' : ''}>Business</option>
            <option value="Personal" ${data && data.type === 'Personal' ? 'selected' : ''}>Personal</option>
          </select>
        </div>
        <div class="form-group">
          <label>Note (Optional)</label>
          <input type="text" id="formNote" class="input" placeholder="Any note..." value="${data ? data.note || '' : ''}">
        </div>
      `;
      break;

    case 'budget':
      title.textContent = data ? 'Edit Budget' : 'Set Budget';
      editingStore = 'budgets';
      body.innerHTML = `
        <div class="form-group">
          <label>Category *</label>
          <input type="text" id="formCategory" class="input" placeholder="e.g., Food, Rent, Transport" value="${data ? data.category : ''}" ${data ? 'readonly' : ''}>
        </div>
        <div class="form-group">
          <label>Monthly Budget (₹) *</label>
          <input type="number" id="formAmount" class="input" placeholder="Budget amount" value="${data ? data.amount : ''}">
        </div>
      `;
      break;

    case 'party':
      title.textContent = data ? 'Edit Entry' : 'Add Entry';
      editingStore = 'parties';
      body.innerHTML = `
        <div class="form-group">
          <label>Person/Entity Name *</label>
          <input type="text" id="formName" class="input" placeholder="Name" value="${data ? data.name : ''}">
        </div>
        <div class="form-group">
          <label>Type *</label>
          <select id="formType" class="input">
            <option value="debtor" ${data && data.type === 'debtor' ? 'selected' : currentPartyType === 'debtor' ? 'selected' : ''}>Debtor (Owes me money)</option>
            <option value="creditor" ${data && data.type === 'creditor' ? 'selected' : currentPartyType === 'creditor' ? 'selected' : ''}>Creditor (I owe them)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Amount (₹) *</label>
          <input type="number" id="formAmount" class="input" placeholder="Amount" value="${data ? data.amount : ''}">
        </div>
        <div class="form-group">
          <label>Date *</label>
          <input type="date" id="formDate" class="input" value="${data ? data.date : new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label>Due Date</label>
          <input type="date" id="formDueDate" class="input" value="${data ? data.dueDate : ''}">
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="formStatus" class="input">
            <option value="Pending" ${data && data.status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Partially Paid" ${data && data.status === 'Partially Paid' ? 'selected' : ''}>Partially Paid</option>
            <option value="Paid" ${data && data.status === 'Paid' ? 'selected' : ''}>Paid</option>
          </select>
        </div>
        <div class="form-group">
          <label>Note</label>
          <input type="text" id="formNote" class="input" placeholder="Any note..." value="${data ? data.note || '' : ''}">
        </div>
      `;
      break;

    case 'savingsGoal':
      title.textContent = 'Set Monthly Savings Goal';
      editingStore = 'savingsGoals';
      body.innerHTML = `
        <div class="form-group">
          <label>Monthly Savings Target (₹) *</label>
          <input type="number" id="formTarget" class="input" placeholder="How much to save per month" value="${data ? data.monthlyTarget : ''}">
        </div>
      `;
      break;

    case 'goal':
      title.textContent = data ? 'Edit Goal' : 'Add Goal';
      editingStore = 'goals';
      body.innerHTML = `
        <div class="form-group">
          <label>Goal Title *</label>
          <input type="text" id="formTitle" class="input" placeholder="e.g., Buy a car, Emergency fund" value="${data ? data.title : ''}">
        </div>
        <div class="form-group">
          <label>Target Amount (₹)</label>
          <input type="number" id="formTargetAmount" class="input" placeholder="Target amount" value="${data ? data.targetAmount : ''}">
        </div>
        <div class="form-group">
          <label>Deadline</label>
          <input type="date" id="formDeadline" class="input" value="${data ? data.deadline : ''}">
        </div>
        <div class="form-group">
          <label>Category</label>
          <select id="formGoalCategory" class="input">
            <option value="Short-term" ${data && data.category === 'Short-term' ? 'selected' : ''}>Short-term</option>
            <option value="Medium-term" ${data && data.category === 'Medium-term' ? 'selected' : ''}>Medium-term</option>
            <option value="Long-term" ${data && data.category === 'Long-term' ? 'selected' : ''}>Long-term</option>
          </select>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="formDescription" class="input textarea" placeholder="Describe your goal...">${data ? data.description || '' : ''}</textarea>
        </div>
      `;
      break;
  }

  // Save handler
  saveBtn.onclick = async () => {
    await saveFormData(type);
    closeModal();
    switch (type) {
      case 'income': renderIncome(); refreshDashboard(); break;
      case 'expense': renderExpenses(); refreshDashboard(); break;
      case 'budget': renderBudget(); refreshDashboard(); break;
      case 'party': renderParties(); break;
      case 'savingsGoal': renderSavings(); break;
      case 'goal': renderGoals(); break;
    }
  };

  modal.classList.add('show');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
  editingId = null;
  editingStore = null;
}

async function saveFormData(type) {
  switch (type) {
    case 'income': {
      const data = {
        source: document.getElementById('formSource').value.trim(),
        amount: Number(document.getElementById('formAmount').value),
        date: document.getElementById('formDate').value,
        category: document.getElementById('formCategory').value,
        note: document.getElementById('formNote').value.trim()
      };
      if (!data.source || !data.amount) { showToast('Please fill required fields', 'error'); return; }
      if (editingId) { data.id = editingId; await updateRecord('income', data); }
      else await addRecord('income', data);
      showToast(editingId ? 'Income updated' : 'Income added', 'success');
      break;
    }
    case 'expense': {
      const data = {
        category: document.getElementById('formCategory').value,
        amount: Number(document.getElementById('formAmount').value),
        date: document.getElementById('formDate').value,
        type: document.getElementById('formType').value,
        note: document.getElementById('formNote').value.trim()
      };
      if (!data.category || !data.amount) { showToast('Please fill required fields', 'error'); return; }
      if (editingId) { data.id = editingId; await updateRecord('expenses', data); }
      else await addRecord('expenses', data);
      showToast(editingId ? 'Expense updated' : 'Expense added', 'success');
      break;
    }
    case 'budget': {
      const data = {
        category: document.getElementById('formCategory').value.trim(),
        amount: Number(document.getElementById('formAmount').value)
      };
      if (!data.category || !data.amount) { showToast('Please fill required fields', 'error'); return; }
      await updateRecord('budgets', data);
      showToast('Budget saved', 'success');
      break;
    }
    case 'party': {
      const data = {
        name: document.getElementById('formName').value.trim(),
        type: document.getElementById('formType').value,
        amount: Number(document.getElementById('formAmount').value),
        date: document.getElementById('formDate').value,
        dueDate: document.getElementById('formDueDate').value,
        status: document.getElementById('formStatus').value,
        note: document.getElementById('formNote').value.trim()
      };
      if (!data.name || !data.amount) { showToast('Please fill required fields', 'error'); return; }
      if (editingId) { data.id = editingId; await updateRecord('parties', data); }
      else await addRecord('parties', data);
      showToast(editingId ? 'Entry updated' : 'Entry added', 'success');
      break;
    }
    case 'savingsGoal': {
      const target = Number(document.getElementById('formTarget').value);
      if (!target) { showToast('Please enter target amount', 'error'); return; }
      await updateRecord('savingsGoals', { id: 1, monthlyTarget: target });
      showToast('Savings goal set!', 'success');
      break;
    }
    case 'goal': {
      const data = {
        title: document.getElementById('formTitle').value.trim(),
        targetAmount: Number(document.getElementById('formTargetAmount').value) || 0,
        deadline: document.getElementById('formDeadline').value,
        category: document.getElementById('formGoalCategory').value,
        description: document.getElementById('formDescription').value.trim()
      };
      if (!data.title) { showToast('Please enter goal title', 'error'); return; }
      if (editingId) { data.id = editingId; await updateRecord('goals', data); }
      else await addRecord('goals', data);
      showToast(editingId ? 'Goal updated' : 'Goal added', 'success');
      break;
    }
  }
}

// ============================================
// EDIT / DELETE HELPERS
// ============================================

async function editRecord(store, id) {
  const record = await getRecord(store, id);
  if (!record) { showToast('Record not found', 'error'); return; }

  const typeMap = { 'income': 'income', 'expenses': 'expense', 'budgets': 'budget', 'parties': 'party', 'goals': 'goal' };
  openModal(typeMap[store] || 'income', record);
}

async function deleteAndRefresh(store, id) {
  if (!confirm('Are you sure you want to delete this entry?')) return;
  await deleteRecord(store, id);
  showToast('Deleted', 'success');

  switch (store) {
    case 'income': renderIncome(); refreshDashboard(); break;
    case 'expenses': renderExpenses(); refreshDashboard(); break;
    case 'parties': renderParties(); break;
    case 'goals': renderGoals(); break;
  }
}

// ============================================
// TOAST
// ============================================

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ============================================
// MOBILE DATE
// ============================================

function updateMobileDate() {
  const el = document.getElementById('mobileDate');
  const d = new Date();
  el.textContent = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
