require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ======================== DATABASE CONFIG ========================
// Works locally (XAMPP defaults) and on Railway (which injects either
// a single MYSQL_URL connection string, or separate MYSQLHOST/
// MYSQLUSER/etc. variables, depending on how the MySQL service was
// added to your project).
function buildDbConfig() {
  if (process.env.MYSQL_URL) {
    const dbUrl = new URL(process.env.MYSQL_URL);
    return {
      host: dbUrl.hostname,
      port: Number(dbUrl.port) || 3306,
      user: decodeURIComponent(dbUrl.username),
      password: decodeURIComponent(dbUrl.password),
      database: dbUrl.pathname.replace(/^\//, ''),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };
  }

  return {
    host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
    port: Number(process.env.DB_PORT || process.env.MYSQLPORT) || 3306,
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'rtp_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };
}

const DB_CONFIG = buildDbConfig();

let pool;

async function ensureUsersTableSchema(conn) {
  const [rows] = await conn.query("SHOW COLUMNS FROM users LIKE 'name'");
  if (rows.length === 0) {
    await conn.query("ALTER TABLE users ADD COLUMN name VARCHAR(100) NULL AFTER username");
  }

  const [tokenCol] = await conn.query("SHOW COLUMNS FROM users LIKE 'reset_token'");
  if (tokenCol.length === 0) {
    await conn.query("ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) NULL");
  }

  const [expiresCol] = await conn.query("SHOW COLUMNS FROM users LIKE 'reset_token_expires'");
  if (expiresCol.length === 0) {
    await conn.query("ALTER TABLE users ADD COLUMN reset_token_expires DATETIME NULL");
  }
}

async function getPool() {
  if (!pool) {
    pool = mysql.createPool(DB_CONFIG);
    const conn = await pool.getConnection();
    console.log('✅ Connected to MySQL database');
    await ensureUsersTableSchema(conn);
    conn.release();
  }
  return pool;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';

function isBcryptHash(value) {
  return typeof value === 'string' && value.startsWith('$2');
}

async function verifyPassword(inputPassword, storedPassword) {
  if (!inputPassword || !storedPassword) {
    return false;
  }

  if (isBcryptHash(storedPassword)) {
    return bcrypt.compare(inputPassword, storedPassword);
  }

  return inputPassword === storedPassword;
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

function normalizeRole(role) {
  const value = String(role || '').toLowerCase();
  if (value === 'owner' || value === 'business_owner') return 'owner';
  if (value === 'agent' || value === 'sales_agent') return 'agent';
  return 'agent';
}

// ======================== MIDDLEWARE ========================
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  });
}

function requireOwner(req, res, next) {
  if (req.user?.role !== 'owner') {
    return res.status(403).json({ error: 'Owner access only' });
  }

  next();
}

// ======================== AUTH ROUTES ========================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const loginIdentifier = username || email;

    if (!loginIdentifier || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const db = await getPool();
    const [rows] = await db.query('SELECT * FROM users WHERE username = ? OR email = ?', [loginIdentifier, loginIdentifier]);

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = rows[0];
    const validPassword = await verifyPassword(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: normalizeRole(user.role),
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name || user.username,
        username: user.username,
        email: user.email,
        role: normalizeRole(user.role)
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, username, email, password, role = 'agent' } = req.body;

    if (!name || !username || !password || !email) {
      return res.status(400).json({ error: 'Name, username, email and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const normalizedRole = normalizeRole(role);
    const db = await getPool();
    const [existing] = await db.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, normalizedEmail]);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'A user with that username or email already exists' });
    }

    const hashedPassword = await hashPassword(password);
    const [result] = await db.query(
      'INSERT INTO users (name, username, email, password, role) VALUES (?, ?, ?, ?, ?)',
      [name, username, normalizedEmail, hashedPassword, normalizedRole]
    );

    res.status(201).json({
      user: {
        id: result.insertId,
        name,
        username,
        email: normalizedEmail,
        role: normalizedRole
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const db = await getPool();
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);

    const genericResponse = {
      success: true,
      message: 'If that email is registered, a temporary password has been sent to it.'
    };

    if (rows.length === 0) {
      return res.json(genericResponse);
    }

    const user = rows[0];
    const temporaryPassword = `rtp-${Math.random().toString(36).slice(-8)}`;

    await db.query('UPDATE users SET password = ? WHERE id = ?', [temporaryPassword, user.id]);
    await sendResetEmail(user.email, temporaryPassword, user.username);

    res.json(genericResponse);
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Server error while processing request' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const db = await getPool();

    const [rows] = await db.query(
      'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
      [hashedToken]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired' });
    }

    const user = rows[0];
    const hashedPassword = await hashPassword(newPassword);

    await db.query(
      'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [hashedPassword, user.id]
    );

    res.json({ success: true, message: 'Password has been reset. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error while resetting password' });
  }
});

// ======================== EMAIL / PASSWORD RESET HELPERS ========================
// Real emails are sent through SMTP. Configure these in a .env file next to
// server.js (see .env.example):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
// For Gmail: SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_USER=you@gmail.com,
// SMTP_PASS=<a 16-character Google "App Password", not your normal password>.
const hasSmtpConfig = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let mailTransporter = null;
if (hasSmtpConfig) {
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;

  mailTransporter = nodemailer.createTransport({
    service: process.env.SMTP_SERVICE || (process.env.SMTP_HOST?.includes('gmail') ? 'gmail' : undefined),
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: smtpSecure,
    requireTLS: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

// Checked once at startup so config mistakes are caught immediately instead
// of silently failing the first time a user requests a reset.
async function verifyMailTransporter() {
  if (!mailTransporter) {
    console.warn('⚠️  No SMTP settings found (SMTP_HOST/SMTP_USER/SMTP_PASS). Password reset emails will be logged to this console instead of sent. See .env.example.');
    return;
  }

  try {
    await mailTransporter.verify();
    console.log(`✅ Email is configured — password reset emails will be sent from ${process.env.SMTP_FROM || process.env.SMTP_USER}`);
  } catch (err) {
    console.error('❌ SMTP configuration error — emails will NOT send:', err.message);
    console.error('   Double-check SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in your .env file.');
  }
}

async function sendResetEmail(toEmail, passwordToSend, username) {
  if (!mailTransporter) {
    console.log('\n📧 Password reminder requested for:', toEmail);
    console.log('🔐 Current password:', passwordToSend, '\n');
    return;
  }

  try {
    await mailTransporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: toEmail,
      subject: 'Your RTP System password reminder',
      html: `<p>Hello ${username || 'there'},</p>
             <p>Your temporary RTP System password is:</p>
             <p><strong>${passwordToSend}</strong></p>
             <p>You can sign in with this password now and change it later from your account settings.</p>
             <p>If you did not request this, you can safely ignore this email.</p>`
    });
    console.log(`✅ Password reminder email sent to ${toEmail}`);
  } catch (err) {
    console.error(`❌ Failed to send password reminder email to ${toEmail}:`, err.message);
    console.log('🔐 Password that would have been sent:', passwordToSend);
  }
}

app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;

    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password, new password and user are required' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const db = await getPool();
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];
    const validPassword = await verifyPassword(currentPassword, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await hashPassword(newPassword);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Server error while changing password' });
  }
});

app.post('/api/auth/update-profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { name, username, email, currentPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User is required' });
    }

    const db = await getPool();
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];
    const normalizedEmail = email ? String(email).trim().toLowerCase() : user.email;

    if (email && !EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    if (username && String(username).trim()) {
      const normalizedUsername = String(username).trim();
      const [existing] = await db.query('SELECT id FROM users WHERE username = ? AND id != ?', [normalizedUsername, userId]);
      if (existing.length > 0) {
        return res.status(409).json({ error: 'A user with that username already exists' });
      }
    }

    if (email) {
      const [existing] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [normalizedEmail, userId]);
      if (existing.length > 0) {
        return res.status(409).json({ error: 'A user with that email already exists' });
      }
    }

    const updates = [];
    const values = [];

    if (name !== undefined && String(name).trim()) {
      updates.push('name = ?');
      values.push(String(name).trim());
    }

    if (username !== undefined && String(username).trim()) {
      updates.push('username = ?');
      values.push(String(username).trim());
    }

    if (email !== undefined && String(email).trim()) {
      updates.push('email = ?');
      values.push(normalizedEmail);
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Your current password is required to change it' });
      }

      const validPassword = await verifyPassword(currentPassword, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      updates.push('password = ?');
      values.push(await hashPassword(newPassword));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No changes were provided' });
    }

    values.push(userId);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    const [updatedRows] = await db.query('SELECT id, name, username, email, role FROM users WHERE id = ?', [userId]);
    const updatedUser = updatedRows[0];

    const token = jwt.sign(
      {
        id: updatedUser.id,
        role: normalizeRole(updatedUser.role),
        email: updatedUser.email
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: updatedUser.id,
        name: updatedUser.name || updatedUser.username,
        username: updatedUser.username,
        email: updatedUser.email,
        role: normalizeRole(updatedUser.role)
      }
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Server error while updating profile' });
  }
});

// ======================== PRODUCT ROUTES ========================
app.get('/api/products', authenticateToken, async (_req, res) => {
  try {
    const db = await getPool();
    const [rows] = await db.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.post('/api/products', authenticateToken, requireOwner, async (req, res) => {
  try {
    const { name, sku, category, description, price = 0 } = req.body;
    if (!name || !sku) return res.status(400).json({ error: 'Name and SKU are required' });

    const db = await getPool();
    const [result] = await db.query(
      'INSERT INTO products (name, sku, category, description, price, effective_date) VALUES (?, ?, ?, ?, ?, NOW())',
      [name, sku, category || 'General', description || name, Number(price)]
    );

    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Add product error:', err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'SKU already exists' });
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// ======================== PRICE UPDATE ROUTE ========================
app.post('/api/prices/update', authenticateToken, requireOwner, async (req, res) => {
  try {
    const { productId, newPrice, reason } = req.body;
    const db = await getPool();

    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [Number(productId)]);
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });

    const product = rows[0];

    await db.query(
      'INSERT INTO price_history (product_id, old_price, new_price, reason) VALUES (?, ?, ?, ?)',
      [product.id, product.price, Number(newPrice), reason || 'Price update']
    );

    await db.query(
      'UPDATE products SET price = ?, last_reason = ?, effective_date = NOW() WHERE id = ?',
      [Number(newPrice), reason || 'Price update', Number(productId)]
    );

    const [updated] = await db.query('SELECT * FROM products WHERE id = ?', [Number(productId)]);

    io.emit('price-updated', {
      productId: Number(productId),
      newPrice: Number(newPrice),
      reason: reason || 'Price update'
    });

    res.json({ success: true, product: updated[0] });
  } catch (err) {
    console.error('Price update error:', err);
    res.status(500).json({ error: 'Failed to update price' });
  }
});

// ======================== SYNC ROUTE ========================
app.post('/api/sync/pull', authenticateToken, async (_req, res) => {
  try {
    const db = await getPool();
    const [products] = await db.query('SELECT * FROM products ORDER BY created_at DESC');

    res.json({ success: true, totalProducts: products.length, products });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// ======================== OWNER ROUTES ========================
app.get('/api/owner/stats', authenticateToken, requireOwner, async (_req, res) => {
  try {
    const db = await getPool();
    const [[{ totalUsers }]] = await db.query('SELECT COUNT(*) AS totalUsers FROM users');
    const [[{ totalProducts }]] = await db.query('SELECT COUNT(*) AS totalProducts FROM products');
    const [[{ successfulSyncs }]] = await db.query('SELECT COUNT(*) AS successfulSyncs FROM price_history');
    res.json({ totalUsers, totalProducts, successfulSyncs });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/api/owner/users', authenticateToken, requireOwner, async (_req, res) => {
  try {
    const db = await getPool();
    const [rows] = await db.query('SELECT id, username, email, role, created_at FROM users');
    res.json(rows);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.delete('/api/owner/users/:id', authenticateToken, requireOwner, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const db = await getPool();

    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

    await db.query('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ success: true, removedUser: rows[0] });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ======================== SOCKET ========================
io.on('connection', () => {});

// ======================== START SERVER ========================
function startServer(port = 5000) {
  return new Promise((resolve) => {
    const listener = server.listen(port, () => resolve({ server, port: listener.address().port }));
  });
}

function stopServer(serverInstance) {
  return new Promise((resolve, reject) => {
    if (!serverInstance) return resolve();
    serverInstance.close((error) => (error ? reject(error) : resolve()));
  });
}

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  getPool()
    .then(() => verifyMailTransporter())
    .then(() => {
      server.listen(PORT, () => console.log(`🚀 API server running at http://localhost:${PORT}`));
    })
    .catch((err) => {
      console.error('❌ Failed to connect to database:', err.message);
      console.error('Make sure XAMPP MySQL is running and the database exists.');
      process.exit(1);
    });
}

module.exports = { startServer, stopServer };
