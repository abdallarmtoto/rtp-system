const test = require('node:test');
const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');

const { startServer, stopServer } = require('../server.js');

let server;
let baseUrl;

async function registerUser({ name, username, password, role, email }) {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, username, password, role, email: email || `${username}@example.com` })
  });
  return response;
}

async function loginUser(username, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return response;
}

test.before(async () => {
  const result = await startServer(0);
  server = result.server;
  baseUrl = `http://127.0.0.1:${result.port}`;
});

test.after(async () => {
  await stopServer(server);
});

test('login endpoint returns a token and user', async () => {
  const username = `owner-${Date.now()}`;
  await registerUser({ name: 'Owner User', username, password: 'owner123', role: 'owner' });

  const response = await loginUser(username, 'owner123');

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.token);
  assert.equal(body.user.role, 'owner');
});

test('registration stores the submitted name and username in the database', async () => {
  const username = `persist-${Date.now()}`;
  const name = 'Persisted User';

  const registerResponse = await registerUser({ name, username, password: 'persist123', role: 'agent' });
  assert.equal(registerResponse.status, 201);

  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'rtp_system'
  });

  try {
    const [rows] = await conn.query('SELECT name, username, role FROM users WHERE username = ?', [username]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, name);
    assert.equal(rows[0].username, username);
    assert.equal(rows[0].role, 'agent');
  } finally {
    await conn.end();
  }
});

test('products endpoint returns an array', async () => {
  const username = `owner-${Date.now() + 1}`;
  await registerUser({ name: 'Owner User 2', username, password: 'owner123', role: 'owner' });

  const loginResponse = await loginUser(username, 'owner123');
  const { token } = await loginResponse.json();

  const response = await fetch(`${baseUrl}/api/products`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(Array.isArray(body));
});

test('owner can list registered agents', async () => {
  const ownerUsername = `owner-${Date.now() + 2}`;
  await registerUser({ name: 'Owner User 3', username: ownerUsername, password: 'owner123', role: 'owner' });
  await registerUser({ name: 'Agent User', username: `agent-${Date.now() + 3}`, password: 'agent123', role: 'agent' });

  const loginResponse = await loginUser(ownerUsername, 'owner123');
  const { token } = await loginResponse.json();

  const response = await fetch(`${baseUrl}/api/owner/users`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(Array.isArray(body));
  assert.ok(body.some((user) => user.role === 'agent'));
});

test('owner can remove a registered agent', async () => {
  const ownerUsername = `owner-${Date.now() + 4}`;
  await registerUser({ name: 'Owner User 4', username: ownerUsername, password: 'owner123', role: 'owner' });

  const createResponse = await registerUser({
    name: 'Temp Agent',
    username: `temp-agent-${Date.now() + 5}`,
    password: 'temp123',
    role: 'agent'
  });
  const created = await createResponse.json();

  const loginResponse = await loginUser(ownerUsername, 'owner123');
  const { token } = await loginResponse.json();

  const deleteResponse = await fetch(`${baseUrl}/api/owner/users/${created.user.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });

  assert.equal(deleteResponse.status, 200);
  const body = await deleteResponse.json();
  assert.equal(body.success, true);
});

test('forgot password stores a temporary password that can be used to log in', async () => {
  const username = `temp-login-${Date.now()}`;
  const email = `${username}@example.com`;
  await registerUser({ name: 'Temp Login', username, password: 'original123', role: 'agent', email });

  const response = await fetch(`${baseUrl}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });

  assert.equal(response.status, 200);

  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'rtp_system'
  });

  try {
    const [rows] = await conn.query('SELECT password FROM users WHERE email = ?', [email]);
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].password, '');
    assert.ok(!String(rows[0].password).startsWith('$2'));

    const loginResponse = await loginUser(username, rows[0].password);
    assert.equal(loginResponse.status, 200);
  } finally {
    await conn.end();
  }
});

test('profile updates can change user details and password', async () => {
  const username = `profile-${Date.now()}`;
  const email = `${username}@example.com`;
  await registerUser({ name: 'Profile User', username, password: 'oldpass123', role: 'agent', email });

  const loginResponse = await loginUser(username, 'oldpass123');
  const { token } = await loginResponse.json();

  const response = await fetch(`${baseUrl}/api/auth/update-profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Updated Name',
      username: 'updated-username',
      email: 'updated@example.com',
      currentPassword: 'oldpass123',
      newPassword: 'newpass456'
    })
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.user.name, 'Updated Name');
  assert.equal(body.user.username, 'updated-username');
  assert.equal(body.user.email, 'updated@example.com');

  const loginWithNewPassword = await loginUser('updated-username', 'newpass456');
  assert.equal(loginWithNewPassword.status, 200);
});
