"use strict";

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

var test = require('node:test');

var assert = require('node:assert/strict');

var mysql = require('mysql2/promise');

var _require = require('../server.js'),
    startServer = _require.startServer,
    stopServer = _require.stopServer;

var server;
var baseUrl;

function registerUser(_ref) {
  var name, username, password, role, email, response;
  return regeneratorRuntime.async(function registerUser$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          name = _ref.name, username = _ref.username, password = _ref.password, role = _ref.role, email = _ref.email;
          _context.next = 3;
          return regeneratorRuntime.awrap(fetch("".concat(baseUrl, "/api/auth/register"), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: name,
              username: username,
              password: password,
              role: role,
              email: email || "".concat(username, "@example.com")
            })
          }));

        case 3:
          response = _context.sent;
          return _context.abrupt("return", response);

        case 5:
        case "end":
          return _context.stop();
      }
    }
  });
}

function loginUser(username, password) {
  var response;
  return regeneratorRuntime.async(function loginUser$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.next = 2;
          return regeneratorRuntime.awrap(fetch("".concat(baseUrl, "/api/auth/login"), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              username: username,
              password: password
            })
          }));

        case 2:
          response = _context2.sent;
          return _context2.abrupt("return", response);

        case 4:
        case "end":
          return _context2.stop();
      }
    }
  });
}

test.before(function _callee() {
  var result;
  return regeneratorRuntime.async(function _callee$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.next = 2;
          return regeneratorRuntime.awrap(startServer(0));

        case 2:
          result = _context3.sent;
          server = result.server;
          baseUrl = "http://127.0.0.1:".concat(result.port);

        case 5:
        case "end":
          return _context3.stop();
      }
    }
  });
});
test.after(function _callee2() {
  return regeneratorRuntime.async(function _callee2$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          _context4.next = 2;
          return regeneratorRuntime.awrap(stopServer(server));

        case 2:
        case "end":
          return _context4.stop();
      }
    }
  });
});
test('login endpoint returns a token and user', function _callee3() {
  var username, response, body;
  return regeneratorRuntime.async(function _callee3$(_context5) {
    while (1) {
      switch (_context5.prev = _context5.next) {
        case 0:
          username = "owner-".concat(Date.now());
          _context5.next = 3;
          return regeneratorRuntime.awrap(registerUser({
            name: 'Owner User',
            username: username,
            password: 'owner123',
            role: 'owner'
          }));

        case 3:
          _context5.next = 5;
          return regeneratorRuntime.awrap(loginUser(username, 'owner123'));

        case 5:
          response = _context5.sent;
          assert.equal(response.status, 200);
          _context5.next = 9;
          return regeneratorRuntime.awrap(response.json());

        case 9:
          body = _context5.sent;
          assert.ok(body.token);
          assert.equal(body.user.role, 'owner');

        case 12:
        case "end":
          return _context5.stop();
      }
    }
  });
});
test('registration stores the submitted name and username in the database', function _callee4() {
  var username, name, registerResponse, conn, _ref2, _ref3, rows;

  return regeneratorRuntime.async(function _callee4$(_context6) {
    while (1) {
      switch (_context6.prev = _context6.next) {
        case 0:
          username = "persist-".concat(Date.now());
          name = 'Persisted User';
          _context6.next = 4;
          return regeneratorRuntime.awrap(registerUser({
            name: name,
            username: username,
            password: 'persist123',
            role: 'agent'
          }));

        case 4:
          registerResponse = _context6.sent;
          assert.equal(registerResponse.status, 201);
          _context6.next = 8;
          return regeneratorRuntime.awrap(mysql.createConnection({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: '',
            database: 'rtp_system'
          }));

        case 8:
          conn = _context6.sent;
          _context6.prev = 9;
          _context6.next = 12;
          return regeneratorRuntime.awrap(conn.query('SELECT name, username, role FROM users WHERE username = ?', [username]));

        case 12:
          _ref2 = _context6.sent;
          _ref3 = _slicedToArray(_ref2, 1);
          rows = _ref3[0];
          assert.equal(rows.length, 1);
          assert.equal(rows[0].name, name);
          assert.equal(rows[0].username, username);
          assert.equal(rows[0].role, 'agent');

        case 19:
          _context6.prev = 19;
          _context6.next = 22;
          return regeneratorRuntime.awrap(conn.end());

        case 22:
          return _context6.finish(19);

        case 23:
        case "end":
          return _context6.stop();
      }
    }
  }, null, null, [[9,, 19, 23]]);
});
test('products endpoint returns an array', function _callee5() {
  var username, loginResponse, _ref4, token, response, body;

  return regeneratorRuntime.async(function _callee5$(_context7) {
    while (1) {
      switch (_context7.prev = _context7.next) {
        case 0:
          username = "owner-".concat(Date.now() + 1);
          _context7.next = 3;
          return regeneratorRuntime.awrap(registerUser({
            name: 'Owner User 2',
            username: username,
            password: 'owner123',
            role: 'owner'
          }));

        case 3:
          _context7.next = 5;
          return regeneratorRuntime.awrap(loginUser(username, 'owner123'));

        case 5:
          loginResponse = _context7.sent;
          _context7.next = 8;
          return regeneratorRuntime.awrap(loginResponse.json());

        case 8:
          _ref4 = _context7.sent;
          token = _ref4.token;
          _context7.next = 12;
          return regeneratorRuntime.awrap(fetch("".concat(baseUrl, "/api/products"), {
            headers: {
              Authorization: "Bearer ".concat(token)
            }
          }));

        case 12:
          response = _context7.sent;
          assert.equal(response.status, 200);
          _context7.next = 16;
          return regeneratorRuntime.awrap(response.json());

        case 16:
          body = _context7.sent;
          assert.ok(Array.isArray(body));

        case 18:
        case "end":
          return _context7.stop();
      }
    }
  });
});
test('owner can list registered agents', function _callee6() {
  var ownerUsername, loginResponse, _ref5, token, response, body;

  return regeneratorRuntime.async(function _callee6$(_context8) {
    while (1) {
      switch (_context8.prev = _context8.next) {
        case 0:
          ownerUsername = "owner-".concat(Date.now() + 2);
          _context8.next = 3;
          return regeneratorRuntime.awrap(registerUser({
            name: 'Owner User 3',
            username: ownerUsername,
            password: 'owner123',
            role: 'owner'
          }));

        case 3:
          _context8.next = 5;
          return regeneratorRuntime.awrap(registerUser({
            name: 'Agent User',
            username: "agent-".concat(Date.now() + 3),
            password: 'agent123',
            role: 'agent'
          }));

        case 5:
          _context8.next = 7;
          return regeneratorRuntime.awrap(loginUser(ownerUsername, 'owner123'));

        case 7:
          loginResponse = _context8.sent;
          _context8.next = 10;
          return regeneratorRuntime.awrap(loginResponse.json());

        case 10:
          _ref5 = _context8.sent;
          token = _ref5.token;
          _context8.next = 14;
          return regeneratorRuntime.awrap(fetch("".concat(baseUrl, "/api/owner/users"), {
            headers: {
              Authorization: "Bearer ".concat(token)
            }
          }));

        case 14:
          response = _context8.sent;
          assert.equal(response.status, 200);
          _context8.next = 18;
          return regeneratorRuntime.awrap(response.json());

        case 18:
          body = _context8.sent;
          assert.ok(Array.isArray(body));
          assert.ok(body.some(function (user) {
            return user.role === 'agent';
          }));

        case 21:
        case "end":
          return _context8.stop();
      }
    }
  });
});
test('owner can remove a registered agent', function _callee7() {
  var ownerUsername, createResponse, created, loginResponse, _ref6, token, deleteResponse, body;

  return regeneratorRuntime.async(function _callee7$(_context9) {
    while (1) {
      switch (_context9.prev = _context9.next) {
        case 0:
          ownerUsername = "owner-".concat(Date.now() + 4);
          _context9.next = 3;
          return regeneratorRuntime.awrap(registerUser({
            name: 'Owner User 4',
            username: ownerUsername,
            password: 'owner123',
            role: 'owner'
          }));

        case 3:
          _context9.next = 5;
          return regeneratorRuntime.awrap(registerUser({
            name: 'Temp Agent',
            username: "temp-agent-".concat(Date.now() + 5),
            password: 'temp123',
            role: 'agent'
          }));

        case 5:
          createResponse = _context9.sent;
          _context9.next = 8;
          return regeneratorRuntime.awrap(createResponse.json());

        case 8:
          created = _context9.sent;
          _context9.next = 11;
          return regeneratorRuntime.awrap(loginUser(ownerUsername, 'owner123'));

        case 11:
          loginResponse = _context9.sent;
          _context9.next = 14;
          return regeneratorRuntime.awrap(loginResponse.json());

        case 14:
          _ref6 = _context9.sent;
          token = _ref6.token;
          _context9.next = 18;
          return regeneratorRuntime.awrap(fetch("".concat(baseUrl, "/api/owner/users/").concat(created.user.id), {
            method: 'DELETE',
            headers: {
              Authorization: "Bearer ".concat(token)
            }
          }));

        case 18:
          deleteResponse = _context9.sent;
          assert.equal(deleteResponse.status, 200);
          _context9.next = 22;
          return regeneratorRuntime.awrap(deleteResponse.json());

        case 22:
          body = _context9.sent;
          assert.equal(body.success, true);

        case 24:
        case "end":
          return _context9.stop();
      }
    }
  });
});
test('forgot password stores a temporary password that can be used to log in', function _callee8() {
  var username, email, response, conn, _ref7, _ref8, rows, loginResponse;

  return regeneratorRuntime.async(function _callee8$(_context10) {
    while (1) {
      switch (_context10.prev = _context10.next) {
        case 0:
          username = "temp-login-".concat(Date.now());
          email = "".concat(username, "@example.com");
          _context10.next = 4;
          return regeneratorRuntime.awrap(registerUser({
            name: 'Temp Login',
            username: username,
            password: 'original123',
            role: 'agent',
            email: email
          }));

        case 4:
          _context10.next = 6;
          return regeneratorRuntime.awrap(fetch("".concat(baseUrl, "/api/auth/forgot-password"), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email: email
            })
          }));

        case 6:
          response = _context10.sent;
          assert.equal(response.status, 200);
          _context10.next = 10;
          return regeneratorRuntime.awrap(mysql.createConnection({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: '',
            database: 'rtp_system'
          }));

        case 10:
          conn = _context10.sent;
          _context10.prev = 11;
          _context10.next = 14;
          return regeneratorRuntime.awrap(conn.query('SELECT password FROM users WHERE email = ?', [email]));

        case 14:
          _ref7 = _context10.sent;
          _ref8 = _slicedToArray(_ref7, 1);
          rows = _ref8[0];
          assert.equal(rows.length, 1);
          assert.notEqual(rows[0].password, '');
          assert.ok(!String(rows[0].password).startsWith('$2'));
          _context10.next = 22;
          return regeneratorRuntime.awrap(loginUser(username, rows[0].password));

        case 22:
          loginResponse = _context10.sent;
          assert.equal(loginResponse.status, 200);

        case 24:
          _context10.prev = 24;
          _context10.next = 27;
          return regeneratorRuntime.awrap(conn.end());

        case 27:
          return _context10.finish(24);

        case 28:
        case "end":
          return _context10.stop();
      }
    }
  }, null, null, [[11,, 24, 28]]);
});
test('profile updates can change user details and password', function _callee9() {
  var username, email, loginResponse, _ref9, token, response, body, loginWithNewPassword;

  return regeneratorRuntime.async(function _callee9$(_context11) {
    while (1) {
      switch (_context11.prev = _context11.next) {
        case 0:
          username = "profile-".concat(Date.now());
          email = "".concat(username, "@example.com");
          _context11.next = 4;
          return regeneratorRuntime.awrap(registerUser({
            name: 'Profile User',
            username: username,
            password: 'oldpass123',
            role: 'agent',
            email: email
          }));

        case 4:
          _context11.next = 6;
          return regeneratorRuntime.awrap(loginUser(username, 'oldpass123'));

        case 6:
          loginResponse = _context11.sent;
          _context11.next = 9;
          return regeneratorRuntime.awrap(loginResponse.json());

        case 9:
          _ref9 = _context11.sent;
          token = _ref9.token;
          _context11.next = 13;
          return regeneratorRuntime.awrap(fetch("".concat(baseUrl, "/api/auth/update-profile"), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: "Bearer ".concat(token)
            },
            body: JSON.stringify({
              name: 'Updated Name',
              username: 'updated-username',
              email: 'updated@example.com',
              currentPassword: 'oldpass123',
              newPassword: 'newpass456'
            })
          }));

        case 13:
          response = _context11.sent;
          assert.equal(response.status, 200);
          _context11.next = 17;
          return regeneratorRuntime.awrap(response.json());

        case 17:
          body = _context11.sent;
          assert.equal(body.user.name, 'Updated Name');
          assert.equal(body.user.username, 'updated-username');
          assert.equal(body.user.email, 'updated@example.com');
          _context11.next = 23;
          return regeneratorRuntime.awrap(loginUser('updated-username', 'newpass456'));

        case 23:
          loginWithNewPassword = _context11.sent;
          assert.equal(loginWithNewPassword.status, 200);

        case 25:
        case "end":
          return _context11.stop();
      }
    }
  });
});