/**
 * Finance Tracker Pro - IndexedDB Database Layer
 */

const DB_NAME = 'FinanceTrackerDB';
const DB_VERSION = 2;

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const database = e.target.result;

      // Income
      if (!database.objectStoreNames.contains('income')) {
        const incomeStore = database.createObjectStore('income', { keyPath: 'id', autoIncrement: true });
        incomeStore.createIndex('date', 'date', { unique: false });
        incomeStore.createIndex('source', 'source', { unique: false });
      }

      // Expenses
      if (!database.objectStoreNames.contains('expenses')) {
        const expenseStore = database.createObjectStore('expenses', { keyPath: 'id', autoIncrement: true });
        expenseStore.createIndex('date', 'date', { unique: false });
        expenseStore.createIndex('category', 'category', { unique: false });
      }

      // Budget
      if (!database.objectStoreNames.contains('budgets')) {
        const budgetStore = database.createObjectStore('budgets', { keyPath: 'category' });
      }

      // Parties (Debtors/Creditors)
      if (!database.objectStoreNames.contains('parties')) {
        const partyStore = database.createObjectStore('parties', { keyPath: 'id', autoIncrement: true });
        partyStore.createIndex('type', 'type', { unique: false });
        partyStore.createIndex('date', 'date', { unique: false });
      }

      // Savings Goals
      if (!database.objectStoreNames.contains('savingsGoals')) {
        database.createObjectStore('savingsGoals', { keyPath: 'id', autoIncrement: true });
      }

      // Savings History
      if (!database.objectStoreNames.contains('savingsHistory')) {
        const savingsStore = database.createObjectStore('savingsHistory', { keyPath: 'month' });
      }

      // Goals
      if (!database.objectStoreNames.contains('goals')) {
        database.createObjectStore('goals', { keyPath: 'id', autoIncrement: true });
      }

      // Planning
      if (!database.objectStoreNames.contains('planning')) {
        database.createObjectStore('planning', { keyPath: 'month' });
      }

      // Monthly Savings (actual month-wise tracking)
      if (!database.objectStoreNames.contains('monthlySavings')) {
        database.createObjectStore('monthlySavings', { keyPath: 'month' });
      }

      // Emotional Journal
      if (!database.objectStoreNames.contains('emotionalJournal')) {
        const emotionalStore = database.createObjectStore('emotionalJournal', { keyPath: 'id', autoIncrement: true });
        emotionalStore.createIndex('date', 'date', { unique: false });
        emotionalStore.createIndex('category', 'category', { unique: false });
      }

      // Quests
      if (!database.objectStoreNames.contains('quests')) {
        database.createObjectStore('quests', { keyPath: 'id' });
      }

      // User Progress
      if (!database.objectStoreNames.contains('userProgress')) {
        database.createObjectStore('userProgress', { keyPath: 'id' });
      }

      // Anomalies
      if (!database.objectStoreNames.contains('anomalies')) {
        const anomalyStore = database.createObjectStore('anomalies', { keyPath: 'id', autoIncrement: true });
        anomalyStore.createIndex('date', 'date', { unique: false });
        anomalyStore.createIndex('category', 'category', { unique: false });
      }

      // Anomaly Settings
      if (!database.objectStoreNames.contains('anomalySettings')) {
        database.createObjectStore('anomalySettings', { keyPath: 'id' });
      }

      // Skip Detections
      if (!database.objectStoreNames.contains('skipDetections')) {
        const skipStore = database.createObjectStore('skipDetections', { keyPath: 'id', autoIncrement: true });
        skipStore.createIndex('date', 'date', { unique: false });
        skipStore.createIndex('category', 'category', { unique: false });
      }

      // Health Metrics
      if (!database.objectStoreNames.contains('healthMetrics')) {
        database.createObjectStore('healthMetrics', { keyPath: 'id' });
      }

      // Streak History
      if (!database.objectStoreNames.contains('streakHistory')) {
        database.createObjectStore('streakHistory', { keyPath: 'date' });
      }
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };

    request.onerror = (e) => {
      console.error('DB Error:', e.target.error);
      reject(e.target.error);
    };
  });
}

// Generic CRUD
function addRecord(storeName, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.add(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function updateRecord(storeName, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteRecord(storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function getAllRecords(storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getRecord(storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getByDateRange(storeName, fromDate, toDate) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index('date');
    const range = IDBKeyRange.bound(fromDate, toDate);
    const request = index.getAll(range);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getByIndex(storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Util
function getMonthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getCurrentMonthKey() {
  return getMonthKey(new Date());
}

function getNextMonthKey() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return getMonthKey(d);
}

function formatCurrency(amount) {
  return '₹' + Number(amount || 0).toLocaleString('en-IN');
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getMonthRange(period = 'current') {
  const now = new Date();
  let from, to;
  if (period === 'current') {
    from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;
  } else if (period === 'last') {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    from = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`;
    to = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-31`;
  } else {
    from = `${now.getFullYear()}-01-01`;
    to = `${now.getFullYear()}-12-31`;
  }
  return { from, to };
}

// ============================================================
// NEW UTILITY FUNCTIONS & CONSTANTS
// ============================================================

// Emotion tracking
function getMoodEmoji(mood) {
  const map = { happy: '😊', sad: '😢', anxious: '😰', angry: '😡', neutral: '😐', excited: '🤩', tired: '😴' };
  return map[mood] || '😐';
}

function getMoodLabel(mood) {
  const map = { happy: 'Happy', sad: 'Sad', anxious: 'Anxious', angry: 'Angry', neutral: 'Neutral', excited: 'Excited', tired: 'Tired' };
  return map[mood] || 'Neutral';
}

// Health score calculation (placeholder)
function calculateHealthScore(metrics) {
  const weights = { savingsRate: 0.25, emergencyFund: 0.2, budgetAdherence: 0.2, debtRatio: 0.15, investmentHealth: 0.1, spendingConsistency: 0.1 };
  return Math.round(Object.entries(weights).reduce((sum, [key, w]) => sum + (metrics[key] || 0) * w, 0));
}

// Quest definitions
const DEFAULT_QUESTS = [
  { id: 'quest-1', title: 'Track all expenses for 7 days', description: 'Log every expense for a full week', target: 7, progress: 0, xpReward: 100, completed: false, type: 'weekly', category: 'discipline' },
  { id: 'quest-2', title: 'Stay under budget for 5 days', description: 'Keep daily spending below budget', target: 5, progress: 0, xpReward: 150, completed: false, type: 'weekly', category: 'budgeting' },
  { id: 'quest-3', title: 'Save ₹500 this week', description: 'Skip unnecessary purchases', target: 500, progress: 0, xpReward: 200, completed: false, type: 'weekly', category: 'saving' },
  { id: 'quest-4', title: 'No impulse purchases for 3 days', description: 'Avoid buying anything unplanned', target: 3, progress: 0, xpReward: 120, completed: false, type: 'daily', category: 'discipline' },
  { id: 'quest-5', title: 'Cook at home 5 times', description: 'Skip food delivery and cook', target: 5, progress: 0, xpReward: 180, completed: false, type: 'weekly', category: 'saving' },
  { id: 'quest-6', title: 'Check financial health daily', description: 'Open the app and review your finances', target: 5, progress: 0, xpReward: 50, completed: false, type: 'weekly', category: 'awareness' }
];

// Level thresholds
const LEVEL_THRESHOLDS = [0, 200, 500, 1000, 1800, 3000, 5000, 8000, 12000, 18000, 25000];
function getLevelFromXp(xp) {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}
function getXpForNextLevel(xp) {
  const level = getLevelFromXp(xp);
  return LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
}
function getCurrentLevelXp(xp) {
  const level = getLevelFromXp(xp);
  return LEVEL_THRESHOLDS[level - 1] || 0;
}

// Badges definitions
const BADGE_DEFS = [
  { id: 'first-expense', name: 'First Expense', icon: '📝', description: 'Logged your first expense' },
  { id: 'budget-master', name: 'Budget Master', icon: '🎯', description: 'Stayed under budget for a full month' },
  { id: 'streak-7', name: '7-Day Streak', icon: '🔥', description: '7 consecutive days of tracking' },
  { id: 'streak-30', name: '30-Day Streak', icon: '💪', description: '30 consecutive days of tracking' },
  { id: 'saver-star', name: 'Super Saver', icon: '⭐', description: 'Saved 20%+ of income' },
  { id: 'quest-champ', name: 'Quest Champion', icon: '🏆', description: 'Completed 10 quests' },
  { id: 'health-guru', name: 'Health Guru', icon: '💎', description: 'Financial health score above 80' },
  { id: 'emotion-master', name: 'Self Aware', icon: '🧘', description: 'Logged mood with 20 expenses' },
  { id: 'anomaly-hunter', name: 'Anomaly Hunter', icon: '🔍', description: 'Investigated 5 anomalies' }
];
