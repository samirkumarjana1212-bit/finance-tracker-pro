/**
 * Finance Tracker Pro - Main Application
 */

let currentPeriod = 'current';

// ============================================
// GLOBAL MONTH STATE
// ============================================
let currentViewMonth = new Date();

function getViewMonthKey() {
  return `${currentViewMonth.getFullYear()}-${String(currentViewMonth.getMonth()+1).padStart(2,'0')}`;
}
function getViewMonthName() {
  return currentViewMonth.toLocaleDateString('en-US', { month:'long', year:'numeric' });
}
function getViewMonthRange() {
  const y = currentViewMonth.getFullYear();
  const m = currentViewMonth.getMonth() + 1;
  const lastDay = new Date(y, m, 0).getDate();
  return { from: `${y}-${String(m).padStart(2,'0')}-01`, to: `${y}-${String(m).padStart(2,'0')}-${lastDay}` };
}
let currentPartyType = 'debtor';
let editingId = null;
let editingStore = null;

// ============================================
// INIT
// ============================================

let selectedMood = 'neutral';

// ============================================
// LOCAL STORAGE HELPERS (Fallback for IndexedDB)
// ============================================

function lsGet(key) {
  try { return JSON.parse(localStorage.getItem('finance_' + key)) || []; } catch(e) { return []; }
}
function lsSet(key, val) {
  localStorage.setItem('finance_' + key, JSON.stringify(val));
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await openDB();
    initNavigation();
    initGlobalMonthBar();
    initDashboard();
    initIncome();
    initExpenses();
    initBudget();
    initParties();
    initSavings();
    initGoals();
    initPlanning();
    initHealth();
    initEmotional();
    initQuests();
    initAnomalies();
    initModals();
    updateMobileDate();
    updateGlobalMonthLabel();
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
  if (page === 'income') { renderIncome(); updateGlobalMonthLabel(); }
  if (page === 'expenses') { renderExpenses(); updateGlobalMonthLabel(); }
  if (page === 'budget') { renderBudget(); updateGlobalMonthLabel(); }
  if (page === 'debtors-creditors') renderParties();
  if (page === 'savings') renderSavings();
  if (page === 'goals') renderGoals();
  if (page === 'planning') renderPlanning();
  if (page === 'health') renderHealth();
  if (page === 'emotional') renderEmotional();
  if (page === 'quests') renderQuests();
  if (page === 'anomalies') renderAnomalies();
}

// ============================================
// DASHBOARD
// ============================================

function initDashboard() {}

async function refreshAll() {
  await refreshDashboard();
  renderHealth(); renderQuests(); renderBudget(); renderSavings();
  renderIncome(); renderExpenses(); renderParties(); renderGoals();
  renderPlanning(); renderEmotional(); renderAnomalies();
  updateGlobalMonthLabel();
  await updateQuestsFromExpenses();
  await updateStreakProgress();
  await syncSavingsHistory();
}

async function refreshDashboard() {
  const { from, to } = getViewMonthRange();

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
  const prevMonth = new Date(currentViewMonth); prevMonth.setMonth(prevMonth.getMonth()-1);
  const pmKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth()+1).padStart(2,'0')}-`;
  const lastIncome = allIncome.filter(i => i.date.startsWith(pmKey)).reduce((s,i)=>s+Number(i.amount),0);
  const lastExpense = allExpenses.filter(e => e.date.startsWith(pmKey)).reduce((s,e)=>s+Number(e.amount),0);

  document.getElementById('statIncomeChange').textContent =
    lastIncome ? `${((totalIncome - lastIncome) / lastIncome * 100).toFixed(1)}% vs last month` : '—';
  document.getElementById('statExpenseChange').textContent =
    lastExpense ? `${((totalExpense - lastExpense) / lastExpense * 100).toFixed(1)}% vs last month` : '—';

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

  // Streak
  renderStreakStat(expenses, allExpenses);

  // Dashboard widgets
  renderDashHealthWidget(income, expenses);
  renderDashStreakWidget(expenses);
  renderDashSkipWidget(expenseByCat, allExpenses);
  renderDashQuestWidget();
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
      <td><strong>${r.category}</strong>${r.mood ? ` <span style="font-size:1.2em">${getMoodEmoji(r.mood)}</span>` : ''}</td>
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
  const { from, to } = getViewMonthRange();
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
        <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">
          <button class="btn btn-secondary btn-sm" onclick="editBudgetCard('${b.category}',${b.amount})"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
          <button class="btn btn-secondary btn-sm" style="background:rgba(239,68,68,0.1);color:var(--danger)" onclick="deleteBudgetCard('${b.category}')"><i class="fa-solid fa-trash"></i> Delete</button>
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
  const { from, to } = getViewMonthRange();
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
        <div class="form-group">
          <label>How were you feeling? (Optional)</label>
          <div class="mood-selector" id="moodSelector">
            <button class="mood-btn" data-mood="happy" title="Happy">😊</button>
            <button class="mood-btn" data-mood="sad" title="Sad">😢</button>
            <button class="mood-btn" data-mood="anxious" title="Anxious">😰</button>
            <button class="mood-btn" data-mood="angry" title="Angry">😡</button>
            <button class="mood-btn" data-mood="neutral" title="Neutral">😐</button>
            <button class="mood-btn" data-mood="excited" title="Excited">🤩</button>
            <button class="mood-btn" data-mood="tired" title="Tired">😴</button>
          </div>
          <input type="hidden" id="formMood" value="">
        </div>
      `;
      break;

    case 'journalEntry':
      title.textContent = 'Add Mood Journal Entry';
      editingStore = 'emotionalJournal';
      body.innerHTML = `
        <div class="form-group">
          <label>Date *</label>
          <input type="date" id="formDate" class="input" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label>Category</label>
          <select id="formCategory" class="input">
            <option value="Food">Food</option><option value="Shopping">Shopping</option><option value="Entertainment">Entertainment</option>
            <option value="Transport">Transport</option><option value="Healthcare">Healthcare</option><option value="Other">Other</option>
          </select>
        </div>
        <div class="form-group">
          <label>Amount (₹)</label>
          <input type="number" id="formAmount" class="input" placeholder="Amount spent">
        </div>
        <div class="form-group">
          <label>How were you feeling? *</label>
          <div class="mood-selector" id="moodSelector">
            <button class="mood-btn" data-mood="happy" title="Happy">😊</button>
            <button class="mood-btn" data-mood="sad" title="Sad">😢</button>
            <button class="mood-btn" data-mood="anxious" title="Anxious">😰</button>
            <button class="mood-btn" data-mood="angry" title="Angry">😡</button>
            <button class="mood-btn" data-mood="neutral" title="Neutral">😐</button>
            <button class="mood-btn" data-mood="excited" title="Excited">🤩</button>
            <button class="mood-btn" data-mood="tired" title="Tired">😴</button>
          </div>
          <input type="hidden" id="formMood" value="">
        </div>
        <div class="form-group">
          <label>Note</label>
          <textarea id="formNote" class="input textarea" placeholder="What happened?"></textarea>
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

  // Mood selector init
  initMoodSelector(body, data);

  // Add delete button to modal if editing
  const footer = document.querySelector('.modal-footer');
  const existingDeleteBtn = document.getElementById('modalDeleteBtn');
  if (existingDeleteBtn) existingDeleteBtn.remove();
  if (data && editingStore) {
    const delBtn = document.createElement('button');
    delBtn.id = 'modalDeleteBtn';
    delBtn.className = 'btn btn-secondary';
    delBtn.style.cssText = 'background:rgba(239,68,68,0.15);color:var(--danger);margin-right:auto';
    delBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete';
    delBtn.onclick = async () => {
      if (confirm('Delete this entry permanently?')) {
        await deleteRecord(editingStore, data.id);
        closeModal();
        showToast('Deleted', 'success');
        refreshAll();
      }
    };
    footer.insertBefore(delBtn, footer.firstChild);
  }

  // Save handler
  saveBtn.onclick = async () => {
    await saveFormData(type);
    closeModal();
    refreshAll();
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
      await refreshAll();
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
      data.mood = document.getElementById('formMood')?.value || '';
      if (!data.category || !data.amount) { showToast('Please fill required fields', 'error'); return; }
      if (editingId) { data.id = editingId; await updateRecord('expenses', data); }
      else await addRecord('expenses', data);
      if (data.mood) {
        try {
          await addRecord('emotionalJournal', { date: data.date, amount: data.amount, category: data.category, mood: data.mood, note: data.note || '' });
        } catch(e) {}
      }
      await runAnomalyDetection();
      showToast(editingId ? 'Expense updated' : 'Expense added', 'success');
      await refreshAll();
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
      await refreshAll();
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
      await refreshAll();
      break;
    }
    case 'savingsGoal': {
      const target = Number(document.getElementById('formTarget').value);
      if (!target) { showToast('Please enter target amount', 'error'); return; }
      await updateRecord('savingsGoals', { id: 1, monthlyTarget: target });
      showToast('Savings goal set!', 'success');
      await refreshAll();
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
      await refreshAll();
      break;
    }
    case 'journalEntry': {
      const data = {
        date: document.getElementById('formDate').value,
        category: document.getElementById('formCategory').value,
        amount: Number(document.getElementById('formAmount').value) || 0,
        mood: document.getElementById('formMood')?.value || 'neutral',
        note: document.getElementById('formNote').value.trim()
      };
      if (!data.mood) { showToast('Please select a mood', 'error'); return; }
      try { await addRecord('emotionalJournal', data); } catch(e) { lsSet('emotionalJournal', [...lsGet('emotionalJournal'), data]); }
      showToast('Journal entry saved!', 'success');
      await refreshAll();
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

  const typeMap = { 'income': 'income', 'expenses': 'expense', 'budgets': 'budget', 'parties': 'party', 'goals': 'goal', 'emotionalJournal': 'journalEntry' };
  openModal(typeMap[store] || 'income', record);
}

async function deleteAndRefresh(store, id) {
  if (!confirm('Are you sure you want to delete this entry?')) return;
  await deleteRecord(store, id);
  showToast('Deleted', 'success');

  switch (store) {
    case 'income': case 'expenses': case 'parties': case 'goals': case 'emotionalJournal': case 'budgets':
      refreshAll(); return;
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

// GLOBAL MONTH BAR
function initGlobalMonthBar() {
  document.getElementById('btnPrevMonth').onclick = () => { currentViewMonth.setMonth(currentViewMonth.getMonth()-1); updateGlobalMonthLabel(); refreshAll(); };
  document.getElementById('btnNextMonth').onclick = () => { currentViewMonth.setMonth(currentViewMonth.getMonth()+1); updateGlobalMonthLabel(); refreshAll(); };
  document.getElementById('btnCurrentMonth').onclick = () => { currentViewMonth = new Date(); updateGlobalMonthLabel(); refreshAll(); };
}
function updateGlobalMonthLabel() {
  const el = document.getElementById('globalMonthLabel'); if(el) el.textContent = getViewMonthName();
  const mi = document.getElementById('incomeMonthLabel'); if(mi) mi.textContent = 'for ' + getViewMonthName();
  const me = document.getElementById('expenseMonthLabel'); if(me) me.textContent = 'for ' + getViewMonthName();
  const bm = document.getElementById('budgetMonthDisplay'); if(bm) bm.textContent = getViewMonthName();
}

/** Budget card inline edit/delete */
async function editBudgetCard(cat, amt) {
  openModal('budget', { category: cat, amount: amt });
}
async function deleteBudgetCard(cat) {
  if (!confirm(`Delete budget for "${cat}"?`)) return;
  await deleteRecord('budgets', cat);
  showToast('Budget deleted', 'success');
  refreshAll();
}

// ============================================
// MOBILE DATE
// ============================================

function updateMobileDate() {
  const el = document.getElementById('mobileDate');
  const d = new Date();
  el.textContent = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ============================================
// DASHBOARD WIDGETS (NEW)
// ============================================

function renderStreakStat(expenses) {
  const today = new Date().toISOString().split('T')[0];
  let days = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayExp = expenses.filter(e => e.date === dateStr);
    if (dayExp.length > 0) days++; else break;
  }
  const el = document.getElementById('statStreak'); if (el) el.textContent = days + ' days';
}

async function renderDashHealthWidget(income, expenses) {
  const totalInc = income.reduce((s,i)=>s+Number(i.amount),0);
  const totalExp = expenses.reduce((s,e)=>s+Number(e.amount),0);
  const savingsRate = totalInc > 0 ? Math.min(100,((totalInc-totalExp)/totalInc)*100) : 0;
  const score = Math.round(savingsRate * 0.6 + 30);

  const el = document.getElementById('dashHealthScore'); if(!el) return;
  el.textContent = score;
  const fill = document.getElementById('dashHealthFill'); if(!fill) return;
  const circ = 2*Math.PI*42;
  fill.setAttribute('stroke-dasharray', circ);
  fill.setAttribute('stroke-dashoffset', circ - (score/100)*circ);
  fill.setAttribute('stroke', score>=80?'#22c55e':score>=60?'#3b82f6':score>=40?'#f59e0b':'#ef4444');
  const label = document.getElementById('dashHealthLabel'); if(label) label.textContent = score>=80?'Excellent':score>=60?'Good':score>=40?'Fair':'Poor';
}

async function renderDashStreakWidget(expenses) {
  const el = document.getElementById('dashFlame'); if(!el) return;
  let streak = 0;
  for (let i=0;i<30;i++){const d=new Date();d.setDate(d.getDate()-i);const s=d.toISOString().split('T')[0];if(expenses.some(e=>e.date===s)) streak++;else break;}
  el.parentElement.querySelector('.streak-count').textContent = streak;
  el.style.opacity = streak>0 ? '1':'0.3';
  document.getElementById('dashStreakLabel').textContent = streak>=7?'Keep it up!':streak>=3?'Getting there':'Start tracking';
}

async function renderDashSkipWidget(expenseByCat, allExpenses) {
  const container = document.getElementById('skipSuggestion'); if(!container) return;
  const prevMonth = new Date(); prevMonth.setMonth(prevMonth.getMonth()-1);
  const pmKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth()+1).padStart(2,'0')}-`;
  const prevExp = allExpenses.filter(e=>e.date.startsWith(pmKey));
  const prevByCat={}; prevExp.forEach(e=>{prevByCat[e.category]=(prevByCat[e.category]||0)+Number(e.amount);});

  let bestSkip = null;
  for(const [cat,amt] of Object.entries(expenseByCat)){const prev=prevByCat[cat]||0;if(prev>amt&&(prev-amt)>100){if(!bestSkip||(prev-amt)>(bestSkip.prev-bestSkip.curr)) bestSkip={cat,curr:amt,prev};}}
  if(bestSkip){const diff=Math.round(bestSkip.prev-bestSkip.curr);container.innerHTML=`<div class='skip-suggestion'><i class='fa-solid fa-lightbulb'></i> You spent <strong>${formatCurrency(diff)}</strong> less on <strong>${bestSkip.cat}</strong> vs last month! <div class='skip-amount'>Save ${formatCurrency(Math.round(diff*0.7))}?</div><button class='btn btn-sm btn-primary' style='margin-top:8px' onclick="window.navigateTo('savings')">Save It</button></div>`;}
  else{container.innerHTML='<div class="skip-suggestion" style="opacity:0.6"><i class="fa-solid fa-chart-line"></i> Add more expenses to see saving opportunities</div>';}
}

async function renderDashQuestWidget() {
  const el = document.getElementById('questMiniList'); if(!el) return;
  let quests = []; try { quests = await getAllRecords('quests'); } catch(e){quests=DEFAULT_QUESTS;}
  const active = quests.filter(q=>!q.completed).slice(0,3);
  el.innerHTML = active.length ? active.map(q=>`<div class='quest-mini-item'><span class='quest-mini-name'>${q.title}</span><span class='quest-mini-xp'>+${q.xpReward} XP</span></div>`).join('') : '<div class="quest-mini-item" style="color:var(--text-muted)">No active quests</div>';
}

// ============================================
// FINANCIAL HEALTH PAGE (NEW)
// ============================================

function initHealth() {}

async function renderHealth() {
  const {from,to}=getViewMonthRange();
  const income = (await getAllRecords('income')).filter(i=>i.date>=from&&i.date<=to);
  const expenses = (await getAllRecords('expenses')).filter(e=>e.date>=from&&e.date<=to);
  const totalInc = income.reduce((s,i)=>s+Number(i.amount),0);
  const totalExp = expenses.reduce((s,e)=>s+Number(e.amount),0);
  const budgets = await getAllRecords('budgets');

  const savingsRate = totalInc>0?Math.min(100,((totalInc-totalExp)/totalInc)*100):0;
  const emergencyFund = 50;
  const expenseByCat={};expenses.forEach(e=>{expenseByCat[e.category]=(expenseByCat[e.category]||0)+Number(e.amount);});
  const overCats = budgets.filter(b=>(expenseByCat[b.category]||0)>Number(b.amount)).length;
  const budgetAdherence = budgets.length?Math.round(((budgets.length-overCats)/budgets.length)*100):50;
  const debtors = (await getAllRecords('parties')).filter(p=>p.type==='creditor'&&p.status!=='Paid');
  const totalDebt = debtors.reduce((s,d)=>s+Number(d.amount),0);
  const debtRatio = totalInc>0?Math.max(0,100-(totalDebt/(totalInc*3))*100):50;

  const metrics = {savingsRate,budgetAdherence,emergencyFund,debtRatio,investmentHealth:50,spendingConsistency:60};
  const weights = {savingsRate:0.25,emergencyFund:0.2,budgetAdherence:0.2,debtRatio:0.15,investmentHealth:0.1,spendingConsistency:0.1};
  const score = Math.round(Object.entries(weights).reduce((s,[k,w])=>s+(metrics[k]||0)*w,0));

  await updateRecord('healthMetrics',{id:1,overallScore:score,lastUpdated:new Date().toISOString()}).catch(()=>{});

  const gauge = document.getElementById('healthMainScore'); if(gauge) gauge.textContent = score;
  const grade = document.getElementById('healthGrade'); if(grade){grade.textContent=score>=80?'Excellent':score>=60?'Good':score>=40?'Fair':'Needs Work';grade.style.color=score>=80?'var(--success)':score>=60?'var(--accent)':score>=40?'var(--warning)':'var(--danger)';}
  const fill = document.getElementById('healthMainFill'); if(fill){const c=2*Math.PI*82;fill.setAttribute('stroke-dasharray',c);fill.setAttribute('stroke-dashoffset',c-(score/100)*c);fill.setAttribute('stroke',score>=80?'var(--success)':score>=60?'var(--accent)':score>=40?'var(--warning)':'var(--danger)');}

  const items = [{id:'savingsRate',name:'Savings Rate',score:savingsRate,desc:'% of income saved'},{id:'budgetAdherence',name:'Budget Adherence',score:budgetAdherence,desc:'Categories within budget'},{id:'emergencyFund',name:'Emergency Fund',score:emergencyFund,desc:'Months of expenses covered'},{id:'debtRatio',name:'Debt Management',score:debtRatio,desc:'Debt-to-income health'},{id:'investmentHealth',name:'Investment Health',score:50,desc:'Portfolio diversification'},{id:'spendingConsistency',name:'Spending Consistency',score:60,desc:'Month-over-month stability'}];
  const breakdown = document.getElementById('healthBreakdown'); if(breakdown) breakdown.innerHTML = items.map(m=>`<div class='health-factor'><div class='factor-header'><span class='factor-name'>${m.name}</span><span class='factor-score' style='color:${m.score>=80?'var(--success)':m.score>=60?'var(--accent)':m.score>=40?'var(--warning)':'var(--danger)'}'>${Math.round(m.score)}</span></div><div class='progress-bar'><div class='progress-fill ${m.score>=80?'safe':m.score>=60?'':m.score>=40?'warning':'danger'}' style='width:${m.score}%'></div></div><div class='factor-desc'>${m.desc}</div></div>`).join('');
}

// ============================================
// EMOTIONAL JOURNAL PAGE (NEW)
// ============================================

function initEmotional() {
  const btn = document.getElementById('btnAddJournalEntry');
  if(btn) btn.addEventListener('click',()=>openModal('journalEntry'));
}

async function renderEmotional() {
  let entries=[];try{entries=await getAllRecords('emotionalJournal');}catch(e){entries=lsGet('emotionalJournal');}
  entries.sort((a,b)=>new Date(b.date)-new Date(a.date));

  const stats = {total:entries.length,moods:{},biggestAmount:0,biggestEntry:null};
  entries.forEach(e=>{stats.moods[e.mood]=(stats.moods[e.mood]||0)+1;if(Number(e.amount)>stats.biggestAmount){stats.biggestAmount=Number(e.amount);stats.biggestEntry=e;}});
  const topMood = Object.entries(stats.moods).sort((a,b)=>b[1]-a[1])[0];

  document.getElementById('emoTotalEntries').textContent = stats.total;
  document.getElementById('emoTopMood').textContent = topMood ? `${getMoodEmoji(topMood[0])} ${getMoodLabel(topMood[0])}` : '—';
  document.getElementById('emoTopMoodCount').textContent = topMood ? `${topMood[1]} times` : '';
  document.getElementById('emoBiggest').textContent = stats.biggestEntry ? formatCurrency(stats.biggestAmount) : '—';

  const tbody = document.getElementById('emoTableBody');
  if(tbody) tbody.innerHTML = entries.length ? entries.map(e=>`<tr><td>${formatDate(e.date)}</td><td>${e.category||'General'}</td><td style='font-weight:600'>${formatCurrency(e.amount)}</td><td style='font-size:1.5em'>${getMoodEmoji(e.mood)}</td><td>${e.note||'—'}</td></tr>`).join('') : '<tr><td colspan="5" class="empty-state">No journal entries yet. Add your first one!</td></tr>';
  document.getElementById('emoEmpty').style.display = entries.length?'none':'block';

  const moodCat={};entries.forEach(e=>{if(!moodCat[e.mood])moodCat[e.mood]={};moodCat[e.mood][e.category||'Other']=(moodCat[e.mood][e.category||'Other']||0)+Number(e.amount);});
  const patterns = document.getElementById('emoPatterns');
  if(patterns) patterns.innerHTML = Object.entries(moodCat).slice(0,4).map(([mood,cats])=>`<div class='pattern-card'><h4>${getMoodEmoji(mood)} When ${getMoodLabel(mood)}</h4>${Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([cat,amt])=>`<div class='pattern-item'><span>${cat}</span><span>${formatCurrency(amt)}</span></div>`).join('')}</div>`).join('') || '<div class="empty-state">Log more entries to see patterns</div>';
}

// ============================================
// QUESTS & REWARDS PAGE (NEW)
// ============================================

async function initQuests() {
  let quests=[];try{quests=await getAllRecords('quests');}catch(e){quests=[];}
  if(!quests.length){for(const q of DEFAULT_QUESTS){try{await addRecord('quests',q);}catch(e){}};}
  let progress=null;try{progress=await getRecord('userProgress',1);}catch(e){progress=null;}
  if(!progress){await updateRecord('userProgress',{id:1,level:1,xp:0,totalXp:0,streak:0,lastActiveDate:'',badgesUnlocked:[]}).catch(()=>{});}
}

async function renderQuests() {
  let quests=[];try{quests=await getAllRecords('quests');}catch(e){quests=[];}
  let progress={level:1,xp:0,totalXp:0,streak:0,badgesUnlocked:[]};try{const p=await getRecord('userProgress',1);if(p)progress=p;}catch(e){}

  const level = getLevelFromXp(progress.totalXp||0);
  const nextXp = getXpForNextLevel(progress.totalXp||0);
  const curXp = getCurrentLevelXp(progress.totalXp||0);
  const xpPct = nextXp>curXp?((progress.totalXp-curXp)/(nextXp-curXp))*100:100;

  document.getElementById('questLevel').textContent = level;
  const xpBar=document.getElementById('questXpBar'); if(xpBar)xpBar.style.width=xpPct+'%';
  document.getElementById('questXpText').textContent = `${progress.totalXp||0}/${nextXp} XP`;

  const activeQ = quests.filter(q=>!q.completed);
  const doneQ = quests.filter(q=>q.completed);
  document.getElementById('activeQuests').innerHTML = activeQ.length ? activeQ.map(q=>`<div class='quest-card'><div class='quest-header'><span class='quest-name'>${q.title}</span><span class='quest-xp'>+${q.xpReward} XP</span></div><div class='progress-bar'><div class='progress-fill safe' style='width:${(q.progress/(q.target||1))*100}%'></div></div><div style='font-size:0.75em;color:var(--text-muted);margin-top:4px'>${q.progress||0}/${q.target} ${q.description}</div></div>`).join(''):'<div class="empty-state">All quests completed! 🎉</div>';
  document.getElementById('completedQuests').innerHTML = doneQ.length ? doneQ.map(q=>`<div class='quest-card completed'><div class='quest-header'><span class='quest-name'>${q.title}</span><span class='quest-xp'>✅ +${q.xpReward} XP</span></div></div>`).join('') : '<div class="empty-state">Complete quests to see them here</div>';

  const streakD = document.getElementById('streakDays'); if(streakD){let h='';for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const day=d.toLocaleDateString('en-US',{weekday:'short'});const active=i<(progress.streak||0);h+=`<div class='streak-day${active?' active':''}'>${day[0]}</div>`;}streakD.innerHTML=h;}
  document.getElementById('questStreakCount').textContent = progress.streak||0;

  const badgeGrid=document.getElementById('badgesGrid');
  if(badgeGrid) badgeGrid.innerHTML = BADGE_DEFS.map(b=>{const unlocked=(progress.badgesUnlocked||[]).includes(b.id);return `<div class='badge-item' style='opacity:${unlocked?'1':'0.35'}'><div class='badge-icon'>${b.icon}</div><div class='badge-name'>${b.name}</div>${unlocked?'<div style="color:var(--success);font-size:0.65em">Unlocked</div>':'<div style="font-size:0.65em;color:var(--text-muted)">Locked</div>'}</div>`;}).join('');
}

// ============================================
// SMART ALERTS / ANOMALIES PAGE (NEW)
// ============================================

async function initAnomalies() {
  let settings = null; try{settings=await getRecord('anomalySettings',1);}catch(e){}
  if(!settings) await updateRecord('anomalySettings',{id:1,sensitivity:3,enabled:true}).catch(()=>{});
  const slider = document.getElementById('anomalySensitivity');
  if(slider){slider.addEventListener('input',async()=>{await updateRecord('anomalySettings',{id:1,sensitivity:Number(slider.value),enabled:true});document.getElementById('sensitivityValue').textContent=slider.value;});}
  const refreshBtn = document.getElementById('btnDetectAnomalies');
  if(refreshBtn) refreshBtn.addEventListener('click', async()=>{await runAnomalyDetection();renderAnomalies();showToast('Anomaly scan complete','success');});
}

async function renderAnomalies() {
  let anomalies=[];try{anomalies=await getAllRecords('anomalies');}catch(e){anomalies=[];}
  anomalies.sort((a,b)=>new Date(b.date)-new Date(a.date));
  let settings={sensitivity:3};try{const s=await getRecord('anomalySettings',1);if(s)settings=s;}catch(e){}
  if(document.getElementById('anomalySensitivity')) document.getElementById('anomalySensitivity').value = settings.sensitivity;
  if(document.getElementById('sensitivityValue')) document.getElementById('sensitivityValue').textContent = settings.sensitivity;

  const active = anomalies.filter(a=>!a.dismissed);
  const list = document.getElementById('anomalyList');
  if(list) list.innerHTML = active.length ? active.map(a=>`<div class='anomaly-item'><div class='anomaly-info'><div class='anomaly-category'>${a.category}</div><div class='anomaly-detail'>Expected: ${formatCurrency(a.expectedAmount)} → Actual: ${formatCurrency(a.actualAmount)} on ${formatDate(a.date)}</div></div><div class='anomaly-deviation ${a.deviationPercent>0?'up':'down'}'>${a.deviationPercent>0?'+':''}${Math.round(a.deviationPercent)}%</div><div class='anomaly-actions'><button class='btn btn-secondary btn-sm' onclick='dismissAnomaly(${a.id})'>Dismiss</button><button class='btn btn-primary btn-sm' onclick='window.navigateTo("expenses")'>Investigate</button></div></div>`).join('') : '<div class="empty-state">No anomalies detected. Keep tracking expenses!</div>';
  document.getElementById('anomalyEmpty').style.display = active.length?'none':'block';
}

async function dismissAnomaly(id){await updateRecord('anomalies',{...await getRecord('anomalies',id),dismissed:true});renderAnomalies();showToast('Anomaly dismissed','info');}

async function runAnomalyDetection(){
  let settings={sensitivity:3};try{const s=await getRecord('anomalySettings',1);if(s)settings=s;}catch(e){}
  const allExp=await getAllRecords('expenses');
  const {from,to}=getMonthRange('current');
  const curMonths=[];for(let i=0;i<3;i++){const d=new Date();d.setMonth(d.getMonth()-i);curMonths.push({from:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`,to:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-31`});}

  const catByMonth={};curMonths.forEach(m=>{allExp.filter(e=>e.date>=m.from&&e.date<=m.to).forEach(e=>{if(!catByMonth[e.category])catByMonth[e.category]={};const k=m.from.substring(0,7);catByMonth[e.category][k]=(catByMonth[e.category][k]||0)+Number(e.amount);});});

  const threshold = [0,50,35,25,18,12][settings.sensitivity]||25;
  const currentMonth = curMonths[0].from.substring(0,7);
  for(const [cat,months] of Object.entries(catByMonth)){
    const pastKeys = Object.keys(months).filter(k=>k!==currentMonth);
    if(pastKeys.length<2) continue;
    const avgPast = pastKeys.reduce((s,k)=>s+months[k],0)/pastKeys.length;
    if(avgPast<200) continue;
    const current = months[currentMonth]||0;
    const deviation = avgPast>0?((current-avgPast)/avgPast)*100:0;
    if(Math.abs(deviation)>=threshold){
      await addRecord('anomalies',{date:new Date().toISOString().split('T')[0],category:cat,expectedAmount:Math.round(avgPast),actualAmount:Math.round(current),deviationPercent:Math.round(deviation),dismissed:false}).catch(()=>{});
    }
  }
}

// ============================================
// MOOD SELECTOR INIT (attached to modal)
// ============================================

function initMoodSelector(body, data) {
  const moodBtns = body.querySelectorAll('.mood-btn');
  if (!moodBtns.length) return;
  moodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      moodBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const moodInput = document.getElementById('formMood');
      if (moodInput) moodInput.value = btn.dataset.mood;
    });
  });
  if (data && data.mood) {
    const existingBtn = body.querySelector(`[data-mood="${data.mood}"]`);
    if (existingBtn) existingBtn.classList.add('selected');
    const moodInput = document.getElementById('formMood');
    if (moodInput) moodInput.value = data.mood;
  }
}

// ============================================
// CROSS-MODULE SYNC ENGINE
// ============================================

async function updateQuestsFromExpenses() {
  const {from,to}=getMonthRange('current');
  const expenses=(await getAllRecords('expenses')).filter(e=>e.date>=from&&e.date<=to);
  const quests = await getAllRecords('quests').catch(()=>[]);
  let progress = {level:1,xp:0,totalXp:0,streak:0,badgesUnlocked:[]};
  try { const p = await getRecord('userProgress',1); if(p) progress = p; } catch(e){}
  const catCount={}; expenses.forEach(e=>{catCount[e.category]=(catCount[e.category]||0)+1;});
  const today = new Date().toISOString().split('T')[0];
  const todayExp = expenses.filter(e=>e.date===today);
  const totalExp = expenses.reduce((s,e)=>s+Number(e.amount),0);
  const allInc = (await getAllRecords('income')).filter(i=>i.date>=from&&i.date<=to);
  const totalInc = allInc.reduce((s,i)=>s+Number(i.amount),0);
  const saved = totalInc - totalExp;
  for (const q of quests) {
    let newProgress = q.progress;
    switch(q.id) {
      case 'quest-1': newProgress = Math.min(q.target, [...new Set(expenses.map(e=>e.date))].length); break;
      case 'quest-2': { const budgets=await getAllRecords('budgets').catch(()=>[]); const eb={};expenses.forEach(e=>{eb[e.category]=(eb[e.category]||0)+Number(e.amount);}); let under=0; budgets.forEach(b=>{if((eb[b.category]||0)<=Number(b.amount))under++;}); newProgress=Math.min(q.target,under); break; }
      case 'quest-3': newProgress = Math.min(q.target, Math.round(saved)); break;
      case 'quest-4': newProgress = todayExp.length===0 ? Math.min(q.target, q.progress+1) : 0; break;
      case 'quest-5': newProgress = Math.min(q.target, (catCount['Food']||0)); break;
      case 'quest-6': newProgress = Math.min(q.target, q.progress+1); break;
    }
    if (newProgress !== q.progress) { q.progress = newProgress; await updateRecord('quests',q).catch(()=>{}); }
    if (q.progress >= q.target && !q.completed) {
      q.completed = true;
      await updateRecord('quests',q).catch(()=>{});
      progress.totalXp = (progress.totalXp||0) + q.xpReward;
      progress.level = getLevelFromXp(progress.totalXp);
      showToast(`Quest Complete: ${q.title}! +${q.xpReward} XP`,'success');
    }
  }
  const badges = progress.badgesUnlocked || [];
  if (!badges.includes('first-expense') && expenses.length>0){badges.push('first-expense');showToast('🏅 Badge Unlocked: First Expense!','success');}
  await updateRecord('userProgress',{id:1,...progress,badgesUnlocked:badges}).catch(()=>{});
}

async function updateStreakProgress() {
  const {from,to}=getMonthRange('current');
  const expenses=(await getAllRecords('expenses')).filter(e=>e.date>=from&&e.date<=to);
  let progress = {level:1,xp:0,totalXp:0,streak:0,badgesUnlocked:[]};
  try { const p = await getRecord('userProgress',1); if(p) progress = p; } catch(e){}
  const today = new Date().toISOString().split('T')[0];
  const todayExp = expenses.filter(e=>e.date===today);
  if (todayExp.length > 0) {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
    if (progress.lastActiveDate !== today) {
      if (progress.lastActiveDate === yesterday.toISOString().split('T')[0]) progress.streak = (progress.streak||0) + 1;
      else progress.streak = 1;
      progress.lastActiveDate = today;
      await updateRecord('userProgress',{id:1,...progress}).catch(()=>{});
    }
  }
  const badges = progress.badgesUnlocked || [];
  if ((progress.streak||0)>=7 && !badges.includes('streak-7')){badges.push('streak-7');showToast('🔥 Badge Unlocked: 7-Day Streak!','success');}
  if ((progress.streak||0)>=30 && !badges.includes('streak-30')){badges.push('streak-30');showToast('💪 Badge Unlocked: 30-Day Streak!','success');}
  await updateRecord('userProgress',{id:1,...progress,badgesUnlocked:badges}).catch(()=>{});
}

async function syncSavingsHistory() {
  const monthKey = getCurrentMonthKey();
  const {from,to}=getMonthRange('current');
  const income=(await getAllRecords('income')).filter(i=>i.date>=from&&i.date<=to).reduce((s,i)=>s+Number(i.amount),0);
  const expenses=(await getAllRecords('expenses')).filter(e=>e.date>=from&&e.date<=to).reduce((s,e)=>s+Number(e.amount),0);
  const saved = Math.max(0, income - expenses);
  const goal=await getRecord('savingsGoals',1).catch(()=>null);
  const target = goal ? goal.monthlyTarget : 0;
  const shortfall = Math.max(0, target - saved);
  if (saved > 0 || expenses > 0) {
    await updateRecord('savingsHistory',{month:monthKey,target,saved,shortfall}).catch(()=>{});
  }
}
