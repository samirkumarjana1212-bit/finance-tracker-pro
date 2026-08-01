/**
 * Finance Tracker Pro - IndexedDB Database Layer
 */

const DB_NAME = 'FinanceTrackerDB';
const DB_VERSION = 1;

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
