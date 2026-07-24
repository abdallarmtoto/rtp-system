// ======================== GLOBAL STATE ========================
const savedAuthToken = localStorage.getItem('authToken');
const savedCurrentUser = localStorage.getItem('currentUser');

let parsedCurrentUser = null;
try {
  parsedCurrentUser = savedCurrentUser ? JSON.parse(savedCurrentUser) : null;
} catch (error) {
  console.warn('Failed to parse saved current user:', error);
}

const state = {
  currentUser: savedAuthToken ? parsedCurrentUser : null,
  authToken: savedAuthToken,
  products: [],
  prices: {},
  users: [],
  syncStatus: null,
  isOnline: navigator.onLine,
  lastSyncTime: localStorage.getItem('lastSyncTime')
};

// Same-origin: works unchanged whether running locally
// (http://localhost:5000) or deployed (e.g. Railway's given URL),
// since the frontend is always served by the same server as the API.
const socket = io(window.location.origin, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

// ======================== API HELPER ========================
const API_BASE = window.location.origin + '/api';

async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (state.authToken) {
    options.headers['Authorization'] = `Bearer ${state.authToken}`;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    
    if (response.status === 401) {
      logout();
      return null;
    }
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API Error');
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    showAlert(error.message, 'danger');
    return null;
  }
}

// ======================== UI RENDERING ========================
function render() {
  const app = document.getElementById('app');
  
  if (!state.authToken) {
    app.innerHTML = renderAuthScreen();
    attachAuthListeners();
  } else if (!state.currentUser) {
    app.innerHTML = '<div class="loading"><div class="spinner"></div><p class="loading-text">Loading...</p></div>';
  } else if (state.currentUser.role === 'owner') {
    app.innerHTML = renderOwnerDashboard();
    attachOwnerListeners();
    loadOwnerData();
  } else if (state.currentUser.role === 'agent') {
    app.innerHTML = renderAgentDashboard();
    attachAgentListeners();
    loadAgentData();
  } else {
    app.innerHTML = '<div class="container"><div class="card"><div class="card-body"><h2>Access denied</h2><p>Your role is not supported by this system.</p></div></div></div>';
  }
}

// ======================== AUTH SCREEN ========================
function renderAuthScreen() {
  return `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <h1>RTP System</h1>
          <p>Real-time Pricing System</p>
        </div>
        <div id="alerts"></div>
        <div class="auth-body">
          <div class="auth-tabs">
            <button class="auth-tab active" data-tab="login">
              <i class="fas fa-sign-in-alt"></i> Login
            </button>
            <button class="auth-tab" data-tab="register">
              <i class="fas fa-user-plus"></i> Register
            </button>
          </div>
          
          <div id="login" class="tab-content active">
            <div class="form-group">
              <label class="form-label">Username</label>
              <input type="text" id="loginUsername" class="form-control" placeholder="Enter your username" required>
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <div class="password-input-wrapper">
                <input type="password" id="loginPassword" class="form-control" placeholder="••••••••" required>
                <button type="button" class="password-toggle" onclick="togglePasswordVisibility('loginPassword', this)">
                  <i class="fas fa-eye"></i>
                </button>
              </div>
            </div>
            <button class="btn btn-primary" onclick="handleLogin()">
              <i class="fas fa-lock"></i> Login
            </button>
            <div class="auth-footer">
              <p><a href="#" onclick="openModal('forgotPasswordModal'); return false;">Forgot password?</a></p>
              <p>© 2026 RTP System. All rights reserved.</p>
            </div>
          </div>
          
          <div id="register" class="tab-content">
            <div class="form-group">
              <label class="form-label">Full Name</label>
              <input type="text" id="regName" class="form-control" placeholder="Enter your full name">
            </div>
            <div class="form-group">
              <label class="form-label">Username</label>
              <input type="text" id="regUsername" class="form-control" placeholder="Enter your username">
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" id="regEmail" class="form-control" placeholder="you@example.com" required>
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <div class="password-input-wrapper">
                <input type="password" id="regPassword" class="form-control" placeholder="••••••••">
                <button type="button" class="password-toggle" onclick="togglePasswordVisibility('regPassword', this)">
                  <i class="fas fa-eye"></i>
                </button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Select Role</label>
              <select id="regRole" class="form-control">
                <option value="agent">Sales Agent</option>
                <option value="owner">Business Owner</option>
              </select>
            </div>
            <button class="btn btn-primary" onclick="handleRegister()">
              <i class="fas fa-user-check"></i> Create Account
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Forgot Password Modal -->
    <div id="forgotPasswordModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">Reset your password</h2>
          <button class="close-btn" onclick="closeModal('forgotPasswordModal')">&times;</button>
        </div>
        <div class="modal-body">
          <p class="text-muted" style="margin-bottom: 1rem;">Enter the email address on your account and we'll send you a temporary password.</p>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" id="forgotPasswordEmail" class="form-control" placeholder="you@example.com" required>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('forgotPasswordModal')">Cancel</button>
          <button class="btn btn-primary" onclick="handleForgotPassword()">
            <i class="fas fa-paper-plane"></i> Send Reset Link
          </button>
        </div>
      </div>
    </div>
  `;
}

// ======================== OWNER DASHBOARD ========================
function renderOwnerDashboard() {
  return `
    <nav class="navbar">
      <div class="navbar-brand">RTP System</div>
      <div class="navbar-right">
        <div class="user-info">
          <i class="fas fa-user-circle"></i>
          <span>${state.currentUser.name || state.currentUser.username}</span>
          <span class="user-role">Owner</span>
        </div>
        <button class="logout-btn" onclick="openProfileModal()" style="margin-right:0.5rem;">
          <i class="fas fa-user-cog"></i> Account
        </button>
        <button class="logout-btn" onclick="logout()">
          <i class="fas fa-sign-out-alt"></i> Logout
        </button>
      </div>
    </nav>
    
    <div class="container">
      <div id="alerts"></div>
      
      <!-- Statistics -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon"><i class="fas fa-users"></i></div>
          <div class="stat-label">Total Users</div>
          <div class="stat-number" id="statUsers">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon"><i class="fas fa-box"></i></div>
          <div class="stat-label">Products</div>
          <div class="stat-number" id="statProducts">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon"><i class="fas fa-sync"></i></div>
          <div class="stat-label">Successful Syncs</div>
          <div class="stat-number" id="statSyncs">0</div>
        </div>
      </div>
      
      <!-- Dashboard Grid -->
      <div class="dashboard">
        <!-- Add Product Card -->
        <div class="card dashboard-item">
          <div class="card-header">
            <i class="fas fa-plus-circle"></i> Add New Product
          </div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Product Name</label>
              <input type="text" id="productName" class="form-control" placeholder="e.g., Premium Widget">
            </div>
            <div class="form-group">
              <label class="form-label">SKU</label>
              <input type="text" id="productSku" class="form-control" placeholder="e.g., SKU-001">
            </div>
            <div class="form-group">
              <label class="form-label">Category</label>
              <input type="text" id="productCategory" class="form-control" placeholder="e.g., Electronics">
            </div>
            <div class="form-group">
              <label class="form-label">Initial Price </label>
              <input type="number" id="productPrice" class="form-control" placeholder="0.00" step="0.01" min="0">
            </div>
            <button class="btn btn-primary w-100" onclick="handleAddProduct()">
              <i class="fas fa-check"></i> Add Product
            </button>
          </div>
        </div>
        
        <!-- Price History Card -->
        <div class="card dashboard-item">
          <div class="card-header">
            <i class="fas fa-history"></i> Recent Activities
          </div>
          <div class="card-body">
            <div id="recentActivities" style="max-height: 400px; overflow-y: auto;">
              <p class="text-muted">No recent activities</p>
            </div>
          </div>
        </div>
        
        <!-- Price Update Card -->
        <div class="card dashboard-item">
          <div class="card-header">
            <i class="fas fa-tag"></i> Quick Price Update
          </div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Select Product</label>
              <select id="quickUpdateProduct" class="form-control">
                <option value="">Choose a product...</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">New Price </label>
              <input type="number" id="quickUpdatePrice" class="form-control" placeholder="0.00" step="0.01" min="0">
            </div>
            <div class="form-group">
              <label class="form-label">Reason</label>
              <textarea id="quickUpdateReason" class="form-control" placeholder="Why are you changing this price?" rows="2"></textarea>
            </div>
            <button class="btn btn-success w-100" onclick="handleQuickUpdate()">
              <i class="fas fa-arrow-up"></i> Update Price
            </button>
          </div>
        </div>
      </div>
      
      <!-- Registered Users -->
      <div class="card" style="margin-top: 2rem;">
        <div class="card-header">
          <i class="fas fa-users-cog"></i> Registered Users
        </div>
        <div class="card-body">
          <div class="search-box" style="margin-bottom: 1rem;">
            <input type="text" id="ownerUserSearch" class="form-control" placeholder="Search users..." onkeyup="filterOwnerUsers()">
            <i class="fas fa-search search-icon"></i>
          </div>
          <div class="table-container">
            <table id="ownerUsersTable" class="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colspan="5" class="text-center text-muted">Loading users...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Products Table -->
      <div class="card" style="margin-top: 2rem;">
        <div class="card-header">
          <i class="fas fa-table"></i> All Products & Prices
        </div>
        <div class="card-body">
          <div class="products-header">
            <div class="search-box">
              <input type="text" id="ownerSearch" placeholder="Search products..." class="form-control" onkeyup="filterOwnerProducts()">
              <i class="fas fa-search search-icon"></i>
            </div>
          </div>
          <div class="table-container">
            <table id="productsTable">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Current Price</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="6" class="text-center text-muted">Loading products...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    
    ${renderProfileModal()}

    <!-- Edit Price Modal -->
    <div id="editPriceModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">Edit Product Price</h2>
          <button class="close-btn" onclick="closeModal('editPriceModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Product</label>
            <input type="text" id="editProductName" class="form-control" disabled>
          </div>
          <div class="form-group">
            <label class="form-label">Current Price</label>
            <div style="display: flex; gap: 0.5rem;">
              <span style="flex: 1; padding: 0.75rem; background: var(--light); border-radius: 8px; display: flex; align-items: center;" id="editCurrentPrice">$0.00</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">New Price </label>
            <input type="number" id="editNewPrice" class="form-control" placeholder="0.00" step="0.01" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Reason for Change</label>
            <textarea id="editReason" class="form-control" placeholder="Explain the price change..." rows="3"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('editPriceModal')">Cancel</button>
          <button class="btn btn-primary" onclick="savePriceChange()">Save Changes</button>
        </div>
      </div>
    </div>
  `;
}

function renderProfileModal() {
  return `
    <div id="profileModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">Account Settings</h2>
          <button class="close-btn" onclick="closeModal('profileModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" id="profileName" class="form-control" value="${state.currentUser.name || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Username</label>
            <input type="text" id="profileUsername" class="form-control" value="${state.currentUser.username || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" id="profileEmail" class="form-control" value="${state.currentUser.email || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Current Password</label>
            <div class="password-input-wrapper">
              <input type="password" id="profileCurrentPassword" class="form-control" placeholder="Enter current password to change it">
              <button type="button" class="password-toggle" onclick="togglePasswordVisibility('profileCurrentPassword', this)">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">New Password</label>
            <div class="password-input-wrapper">
              <input type="password" id="profileNewPassword" class="form-control" placeholder="Leave blank to keep current password">
              <button type="button" class="password-toggle" onclick="togglePasswordVisibility('profileNewPassword', this)">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('profileModal')">Cancel</button>
          <button class="btn btn-primary" onclick="handleProfileUpdate()">Save Changes</button>
        </div>
      </div>
    </div>
  `;
}

// ======================== AGENT DASHBOARD ========================
function renderAgentDashboard() {
  const lastSync = state.lastSyncTime ? new Date(state.lastSyncTime).toLocaleString() : 'Never';
  
  return `
    <nav class="navbar">
      <div class="navbar-brand">RTP System</div>
      <div class="navbar-right">
        <div class="user-info">
          <i class="fas fa-user-circle"></i>
          <span>${state.currentUser.name || state.currentUser.username}</span>
          <span class="user-role">Agent</span>
        </div>
        <div class="status-indicator">
          <div class="status-dot ${state.isOnline ? 'online' : 'offline'}"></div>
          <span>${state.isOnline ? 'Online' : 'Offline'}</span>
        </div>
        <button class="logout-btn" onclick="openProfileModal()" style="margin-right:0.5rem;">
          <i class="fas fa-user-cog"></i> Account
        </button>
        <button class="logout-btn" onclick="logout()">
          <i class="fas fa-sign-out-alt"></i> Logout
        </button>
      </div>
    </nav>
    
    <div class="container">
      <div id="alerts"></div>
      
      <!-- Sync Status Card -->
      <div class="sync-status ${!state.isOnline ? 'offline' : ''}">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <i class="fas ${state.isOnline ? 'fa-wifi' : 'fa-wifi-off'}" style="font-size: 1.5rem;"></i>
          <div>
            <strong>${state.isOnline ? 'Connected' : 'Offline Mode'}</strong>
            <div class="sync-time">
              Last synced: <strong>${lastSync}</strong>
            </div>
          </div>
          <button class="btn btn-sm btn-primary" onclick="handleSync()" style="margin-left: auto;">
            <i class="fas fa-sync-alt"></i> Sync Now
          </button>
        </div>
      </div>
      
      <!-- Search & Filter -->
      <div class="card" style="margin-bottom: 2rem;">
        <div class="card-header">
          <i class="fas fa-search"></i> Find Products
        </div>
        <div class="card-body">
          <div class="search-box" style="margin-bottom: 1rem;">
            <input type="text" id="agentSearch" placeholder="Search by product name or SKU..." class="form-control" onkeyup="filterAgentProducts()">
            <i class="fas fa-search search-icon"></i>
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" onclick="filterByCategory('all')">All</button>
            <button class="btn btn-secondary btn-sm" onclick="filterByCategory('Electronics')">Electronics</button>
            <button class="btn btn-secondary btn-sm" onclick="filterByCategory('Supplies')">Supplies</button>
            <button class="btn btn-secondary btn-sm" onclick="filterByCategory('Services')">Services</button>
          </div>
        </div>
      </div>
      
      <!-- Products Grid -->
      <h2 style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
        <i class="fas fa-box"></i>
        Available Products
      </h2>
      <div class="products-grid" id="agentProducts">
        <div class="empty-state">
          <div class="empty-icon"><i class="fas fa-inbox"></i></div>
          <div class="empty-title">No products available</div>
          <p class="empty-text">Click "Sync Now" to refresh product list</p>
        </div>
      </div>
    </div>
    ${renderProfileModal()}
  `;
}

// ======================== AUTH HANDLERS ========================
function attachAuthListeners() {
  // Tab switching
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(tabName).classList.add('active');
    });
  });
  
  // Enter key
  document.getElementById('loginUsername')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('loginPassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
}

async function handleLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!username || !password) {
    showAlert('Please enter username and password', 'danger');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        showAlert('Invalid username or password', 'danger');
      } else {
        showAlert(data.error || 'Login failed', 'danger');
      }
      return;
    }

    state.authToken = data.token;
    state.currentUser = data.user;
    localStorage.setItem('authToken', state.authToken);
    localStorage.setItem('currentUser', JSON.stringify(state.currentUser));

    showAlert('Login successful!', 'success');
    setTimeout(() => render(), 500);
  } catch (error) {
    console.error('Login error:', error);
    showAlert('Could not reach the server. Please try again.', 'danger');
  }
}

async function handleRegister() {
  const name = document.getElementById('regName').value.trim();
  const username = document.getElementById('regUsername').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const role = document.getElementById('regRole').value;
  
  if (!name || !username || !email || !password) {
    showAlert('Please fill in all fields, including your email', 'danger');
    return;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    showAlert('Please enter a valid email address', 'danger');
    return;
  }
  
  const response = await apiCall('/auth/register', 'POST', {
    name,
    username,
    email,
    password,
    role
  });
  
  if (response && response.user) {
    showAlert('Registration successful! Please login.', 'success');
    
    // Switch to login tab
    document.querySelector('[data-tab="login"]').click();
    document.getElementById('loginUsername').value = username;
  }
}

async function handleForgotPassword() {
  const email = document.getElementById('forgotPasswordEmail').value.trim();

  if (!email) {
    showAlert('Please enter your email address', 'danger');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (!response.ok) {
      showAlert(data.error || 'Something went wrong', 'danger');
      return;
    }

    showAlert(data.message || 'If that email is registered, a temporary password has been sent.', 'success');
    document.getElementById('forgotPasswordEmail').value = '';
    closeModal('forgotPasswordModal');
  } catch (error) {
    console.error('Forgot password error:', error);
    showAlert('Could not reach the server. Please try again.', 'danger');
  }
}

function logout() {
  state.authToken = null;
  state.currentUser = null;
  state.products = [];
  
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  
  showAlert('Logged out successfully', 'success');
  setTimeout(() => render(), 500);
}

function openProfileModal() {
  if (!state.currentUser) return;
  document.getElementById('profileName').value = state.currentUser.name || '';
  document.getElementById('profileUsername').value = state.currentUser.username || '';
  document.getElementById('profileEmail').value = state.currentUser.email || '';
  document.getElementById('profileCurrentPassword').value = '';
  document.getElementById('profileNewPassword').value = '';
  openModal('profileModal');
}

async function handleProfileUpdate() {
  const name = document.getElementById('profileName').value.trim();
  const username = document.getElementById('profileUsername').value.trim();
  const email = document.getElementById('profileEmail').value.trim();
  const currentPassword = document.getElementById('profileCurrentPassword').value;
  const newPassword = document.getElementById('profileNewPassword').value;

  const payload = {};
  if (name) payload.name = name;
  if (username) payload.username = username;
  if (email) payload.email = email;
  if (currentPassword) payload.currentPassword = currentPassword;
  if (newPassword) payload.newPassword = newPassword;

  if (Object.keys(payload).length === 0) {
    showAlert('No changes were provided', 'danger');
    return;
  }

  const response = await apiCall('/auth/update-profile', 'POST', payload);
  if (response && response.user) {
    state.currentUser = response.user;
    localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
    closeModal('profileModal');
    showAlert('Account updated successfully', 'success');
    render();
  }
}


// ======================== OWNER HANDLERS ========================
function populateOwnerQuickUpdateOptions() {
  const quickUpdateSelect = document.getElementById('quickUpdateProduct');
  if (!quickUpdateSelect) return;

  quickUpdateSelect.innerHTML = '<option value="">Choose a product...</option>';

  state.products.forEach(product => {
    const option = document.createElement('option');
    option.value = product.id;
    option.textContent = `${product.name} (${product.sku})`;
    quickUpdateSelect.appendChild(option);
  });
}

function attachOwnerListeners() {
  populateOwnerQuickUpdateOptions();
}

async function loadOwnerData() {
  await loadProducts();
  populateOwnerQuickUpdateOptions();
  await loadStats();
  await loadOwnerUsers();
  renderProductsTable();
}

async function loadOwnerUsers() {
  const users = await apiCall('/owner/users');
  state.users = Array.isArray(users) ? users : [];
  renderOwnerUsersTable();
}

function renderOwnerUsersTable() {
  const tbody = document.querySelector('#ownerUsersTable tbody');

  if (!state.users || state.users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No users registered</td></tr>';
    return;
  }

  tbody.innerHTML = state.users.map((user) => `
    <tr>
      <td>${user.id}</td>
      <td>${user.username}</td>
      <td>${user.email}</td>
      <td>${user.role || 'user'}</td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="removeUser(${user.id})">
          <i class="fas fa-trash"></i> Remove
        </button>
      </td>
    </tr>
  `).join('');
}

function filterAdminAgents() {
  const searchTerm = document.getElementById('adminAgentSearch').value.toLowerCase();
  const rows = document.querySelectorAll('#adminAgentsTable tbody tr');

  rows.forEach((row) => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? '' : 'none';
  });
}

async function removeUser(userId) {
  const confirmed = confirm('Remove this registered user?');
  if (!confirmed) return;

  const response = await apiCall(`/owner/users/${userId}`, 'DELETE');
  if (!response || !response.success) return;

  state.users = state.users.filter((user) => user.id !== userId);
  state.adminAgents = (state.adminAgents || []).filter((user) => user.id !== userId);

  renderOwnerUsersTable();

  const adminAgentsContainer = document.getElementById('adminAgentsTable');
  if (adminAgentsContainer) {
    renderAdminAgentsTable();
  }

  const totalUsersEl = document.getElementById('statUsers');
  if (totalUsersEl) {
    totalUsersEl.textContent = String(state.users.length);
  }

  showAlert('User removed successfully.', 'success');
}

async function removeAgent(agentId) {
  await removeUser(agentId);
}

async function handleAddProduct() {
  const name = document.getElementById('productName').value.trim();
  const sku = document.getElementById('productSku').value.trim();
  const category = document.getElementById('productCategory').value.trim();
  const price = parseFloat(document.getElementById('productPrice').value);
  
  if (!name || !sku || isNaN(price) || price < 0) {
    showAlert('Please fill in all fields', 'danger');
    return;
  }
  
  const response = await apiCall('/products', 'POST', {
    name,
    sku,
    category,
    description: name,
    price
  });
  
  if (response && response.id) {
    showAlert('Product added successfully!', 'success');
    
    // Clear form
    document.getElementById('productName').value = '';
    document.getElementById('productSku').value = '';
    document.getElementById('productCategory').value = '';
    document.getElementById('productPrice').value = '';
    
    // Reload
    await loadOwnerData();
    render();
  }
}

async function handleQuickUpdate() {
  const productId = parseInt(document.getElementById('quickUpdateProduct').value);
  const newPrice = parseFloat(document.getElementById('quickUpdatePrice').value);
  const reason = document.getElementById('quickUpdateReason').value.trim();
  
  if (!productId || !newPrice) {
    showAlert('Please select product and enter price', 'danger');
    return;
  }
  
  if (newPrice < 0) {
    showAlert('Price must be positive', 'danger');
    return;
  }
  
  const response = await apiCall('/prices/update', 'POST', {
    productId,
    newPrice,
    reason: reason || 'Price adjustment'
  });
  
  if (response) {
    showAlert('Price updated and broadcast to all agents!', 'success');
    
    document.getElementById('quickUpdateProduct').value = '';
    document.getElementById('quickUpdatePrice').value = '';
    document.getElementById('quickUpdateReason').value = '';
    
    await loadOwnerData();
  }
}

function showEditPriceModal(product) {
  const modal = document.getElementById('editPriceModal');
  document.getElementById('editProductName').value = product.name;
  document.getElementById('editCurrentPrice').textContent = `Ksh ${parseFloat(product.price || 0).toFixed(2)}`;
  document.getElementById('editNewPrice').value = '';
  document.getElementById('editReason').value = '';
  
  // Store product ID temporarily
  modal.dataset.productId = product.id;
  modal.dataset.currentPrice = product.price || 0;
  
  openModal('editPriceModal');
}

async function savePriceChange() {
  const modal = document.getElementById('editPriceModal');
  const productId = parseInt(modal.dataset.productId);
  const newPrice = parseFloat(document.getElementById('editNewPrice').value);
  const reason = document.getElementById('editReason').value.trim();
  
  if (!newPrice) {
    showAlert('Please enter new price', 'danger');
    return;
  }
  
  if (newPrice < 0) {
    showAlert('Price must be positive', 'danger');
    return;
  }
  
  const response = await apiCall('/prices/update', 'POST', {
    productId,
    newPrice,
    reason: reason || 'Price update'
  });
  
  if (response) {
    showAlert('Price updated successfully!', 'success');
    closeModal('editPriceModal');
    await loadOwnerData();
  }
}

function filterOwnerProducts() {
  const searchTerm = document.getElementById('ownerSearch').value.toLowerCase();
  const rows = document.querySelectorAll('#productsTable tbody tr');
  
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? '' : 'none';
  });
}

function renderProductsTable() {
  const tbody = document.querySelector('#productsTable tbody');
  
  if (state.products.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted">
          <i class="fas fa-inbox"></i> No products yet
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = state.products.map(p => `
    <tr>
      <td><strong>${p.name}</strong></td>
      <td><code>${p.sku}</code></td>
      <td>${p.category || '-'}</td>
      <td><strong class="text-success">Ksh ${parseFloat(p.price || 0).toFixed(2)}</strong></td>
      <td><small class="text-muted">${new Date(p.effective_date).toLocaleDateString()}</small></td>
      <td>
        <div class="table-actions">
          <button class="btn btn-sm btn-primary" onclick='showEditPriceModal(${JSON.stringify(p).replace(/'/g, "\\'")})' title="Edit Price">
            <i class="fas fa-edit"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function loadStats() {
  const response = await apiCall('/owner/stats');
  if (response) {
    document.getElementById('statUsers').textContent = response.totalUsers || 0;
    document.getElementById('statProducts').textContent = response.totalProducts || 0;
    document.getElementById('statSyncs').textContent = response.successfulSyncs || 0;
  }
}

// ======================== AGENT HANDLERS ========================
function attachAgentListeners() {
  // Load initial data
  if (state.isOnline) {
    loadAgentData();
  } else {
    loadOfflineProducts();
  }
}

async function loadAgentData() {
  await loadProducts();
  renderAgentProducts();
}

async function handleSync() {
  showAlert('Syncing prices with server...', 'info');
  
  const response = await apiCall('/sync/pull', 'POST', {
    deviceId: `mobile-${state.currentUser.id}`
  });
  
  if (response && response.success) {
    state.products = response.products;
    state.lastSyncTime = new Date().toISOString();
    localStorage.setItem('lastSyncTime', state.lastSyncTime);
    localStorage.setItem('cachedProducts', JSON.stringify(state.products));
    
    showAlert(`Synced ${response.totalProducts} products successfully!`, 'success');
    render();
  }
}

function loadOfflineProducts() {
  const cached = localStorage.getItem('cachedProducts');
  if (cached) {
    state.products = JSON.parse(cached);
    renderAgentProducts();
  }
}

function renderAgentProducts() {
  const container = document.getElementById('agentProducts');
  
  if (state.products.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon"><i class="fas fa-inbox"></i></div>
        <div class="empty-title">No products available</div>
        <p class="empty-text">Click "Sync Now" to refresh product list</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = state.products.map(p => `
    <div class="product-card">
      <div class="product-header">
        <div class="product-name">${p.name}</div>
        <div class="product-sku">
          <i class="fas fa-barcode"></i> ${p.sku}
        </div>
      </div>
      <div class="product-body">
        ${p.category ? `<div class="product-category">${p.category}</div>` : ''}
        <div class="product-price-section">
          <div class="product-price">Ksh ${parseFloat(p.price || 0).toFixed(2)}</div>
          <div class="product-date">
            <small>Updated: ${new Date(p.effective_date).toLocaleDateString()}</small>
          </div>
        </div>
        <button class="btn btn-primary w-100" onclick="copyPrice('${p.name}', '${p.price}')">
          <i class="fas fa-copy"></i> Copy Price
        </button>
      </div>
    </div>
  `).join('');
}

function filterAgentProducts() {
  const searchTerm = document.getElementById('agentSearch').value.toLowerCase();
  const cards = document.querySelectorAll('.product-card');
  
  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(searchTerm) ? '' : 'none';
  });
}

function filterByCategory(category) {
  const cards = document.querySelectorAll('.product-card');
  
  cards.forEach(card => {
    if (category === 'all') {
      card.style.display = '';
    } else {
      const cardCategory = card.querySelector('.product-category')?.textContent;
      card.style.display = (cardCategory === category) ? '' : 'none';
    }
  });
}

function copyPrice(name, price) {
  navigator.clipboard.writeText(`${name}: Ksh ${parseFloat(price).toFixed(2)}`);
  showAlert('Price copied to clipboard!', 'success');
}

// ======================== SOCKET LISTENERS ========================
socket.on('connect', () => {
  state.isOnline = true;
  if (state.currentUser && state.currentUser.role === 'agent') {
    render();
  }
});

socket.on('disconnect', () => {
  state.isOnline = false;
  if (state.currentUser && state.currentUser.role === 'agent') {
    render();
  }
});

socket.on('price-updated', (data) => {
  showAlert(`Price updated for ${data.productId} to Ksh ${data.newPrice}`, 'info');
  
  // Update product
  const product = state.products.find(p => p.id === data.productId);
  if (product) {
    product.price = data.newPrice;
  }
  
  if (state.currentUser && state.currentUser.role === 'agent') {
    renderAgentProducts();
  } else if (state.currentUser && state.currentUser.role === 'owner') {
    renderProductsTable();
  }
});

// ======================== COMMON FUNCTIONS ========================
async function loadProducts() {
  const response = await apiCall('/products');
  if (response && Array.isArray(response)) {
    state.products = response;
  }
}

function showAlert(message, type = 'success') {
  const alertsContainer = document.getElementById('alerts');
  if (!alertsContainer) return;
  
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type}`;
  alertDiv.innerHTML = `
    <i class="fas ${getAlertIcon(type)}"></i>
    <span>${message}</span>
    <button class="alert-close" onclick="this.parentElement.remove()">&times;</button>
  `;
  
  alertsContainer.appendChild(alertDiv);
  
  if (type !== 'danger') {
    setTimeout(() => alertDiv.remove(), 4000);
  }
}

function getAlertIcon(type) {
  const icons = {
    success: 'fa-check-circle',
    danger: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };
  return icons[type] || 'fa-bell';
}

function openModal(modalId) {
  document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('show');
}

function togglePasswordVisibility(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  button.querySelector('i').classList.toggle('fa-eye');
  button.querySelector('i').classList.toggle('fa-eye-slash');
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('show');
  }
});

// Online/Offline listeners
window.addEventListener('online', () => {
  state.isOnline = true;
  showAlert('Connection restored', 'success');
  if (state.currentUser && state.currentUser.role === 'agent') {
    render();
  }
});

window.addEventListener('offline', () => {
  state.isOnline = false;
  showAlert('Connection lost - Working offline', 'warning');
  if (state.currentUser && state.currentUser.role === 'agent') {
    render();
  }
});

// ======================== INITIALIZE ========================
render();