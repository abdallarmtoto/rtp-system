"use strict";

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

var express = require('express');

var http = require('http');

var cors = require('cors');

var path = require('path');

var mysql = require('mysql2/promise');

var _require = require('socket.io'),
    Server = _require.Server;

var app = express();
var server = http.createServer(app);
var io = new Server(server, {
  cors: {
    origin: '*'
  }
}); // ======================== DATABASE CONFIG ========================
// Change these to match your XAMPP MySQL settings

var DB_CONFIG = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  // XAMPP default is empty; change if you set a password
  database: 'rtp_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};
var pool;

function getPool() {
  var conn;
  return regeneratorRuntime.async(function getPool$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          if (pool) {
            _context.next = 7;
            break;
          }

          pool = mysql.createPool(DB_CONFIG); // Test connection

          _context.next = 4;
          return regeneratorRuntime.awrap(pool.getConnection());

        case 4:
          conn = _context.sent;
          console.log('✅ Connected to MySQL database');
          conn.release();

        case 7:
          return _context.abrupt("return", pool);

        case 8:
        case "end":
          return _context.stop();
      }
    }
  });
} // ======================== MIDDLEWARE ========================


app.use(cors());
app.use(express.json());
app.use(express["static"](__dirname));
app.get('/', function (_req, res) {
  return res.sendFile(path.join(__dirname, 'index.html'));
}); // ======================== AUTH ROUTES ========================

app.post('/api/auth/login', function _callee(req, res) {
  var _req$body, email, password, db, _ref, _ref2, rows, user;

  return regeneratorRuntime.async(function _callee$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.prev = 0;
          _req$body = req.body, email = _req$body.email, password = _req$body.password;
          _context2.next = 4;
          return regeneratorRuntime.awrap(getPool());

        case 4:
          db = _context2.sent;
          _context2.next = 7;
          return regeneratorRuntime.awrap(db.query('SELECT id, username, email, role FROM users WHERE email = ? AND password = ?', [email, password]));

        case 7:
          _ref = _context2.sent;
          _ref2 = _slicedToArray(_ref, 1);
          rows = _ref2[0];

          if (!(rows.length === 0)) {
            _context2.next = 12;
            break;
          }

          return _context2.abrupt("return", res.status(401).json({
            error: 'Invalid email or password'
          }));

        case 12:
          user = rows[0];
          res.json({
            token: "demo-token-".concat(user.id),
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              role: user.role
            }
          });
          _context2.next = 20;
          break;

        case 16:
          _context2.prev = 16;
          _context2.t0 = _context2["catch"](0);
          console.error('Login error:', _context2.t0);
          res.status(500).json({
            error: 'Server error during login'
          });

        case 20:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[0, 16]]);
});
app.post('/api/auth/register', function _callee2(req, res) {
  var _req$body2, username, email, password, _req$body2$role, role, db, _ref3, _ref4, existing, _ref5, _ref6, result;

  return regeneratorRuntime.async(function _callee2$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.prev = 0;
          _req$body2 = req.body, username = _req$body2.username, email = _req$body2.email, password = _req$body2.password, _req$body2$role = _req$body2.role, role = _req$body2$role === void 0 ? 'agent' : _req$body2$role;

          if (!(!username || !email || !password)) {
            _context3.next = 4;
            break;
          }

          return _context3.abrupt("return", res.status(400).json({
            error: 'Missing required fields'
          }));

        case 4:
          _context3.next = 6;
          return regeneratorRuntime.awrap(getPool());

        case 6:
          db = _context3.sent;
          _context3.next = 9;
          return regeneratorRuntime.awrap(db.query('SELECT id FROM users WHERE email = ?', [email]));

        case 9:
          _ref3 = _context3.sent;
          _ref4 = _slicedToArray(_ref3, 1);
          existing = _ref4[0];

          if (!(existing.length > 0)) {
            _context3.next = 14;
            break;
          }

          return _context3.abrupt("return", res.status(409).json({
            error: 'User already exists'
          }));

        case 14:
          _context3.next = 16;
          return regeneratorRuntime.awrap(db.query('INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)', [username, email, password, role]));

        case 16:
          _ref5 = _context3.sent;
          _ref6 = _slicedToArray(_ref5, 1);
          result = _ref6[0];
          res.status(201).json({
            user: {
              id: result.insertId,
              username: username,
              email: email,
              role: role
            }
          });
          _context3.next = 26;
          break;

        case 22:
          _context3.prev = 22;
          _context3.t0 = _context3["catch"](0);
          console.error('Register error:', _context3.t0);
          res.status(500).json({
            error: 'Server error during registration'
          });

        case 26:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[0, 22]]);
}); // ======================== PRODUCT ROUTES ========================

app.get('/api/products', function _callee3(_req, res) {
  var db, _ref7, _ref8, rows;

  return regeneratorRuntime.async(function _callee3$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          _context4.prev = 0;
          _context4.next = 3;
          return regeneratorRuntime.awrap(getPool());

        case 3:
          db = _context4.sent;
          _context4.next = 6;
          return regeneratorRuntime.awrap(db.query('SELECT * FROM products ORDER BY created_at DESC'));

        case 6:
          _ref7 = _context4.sent;
          _ref8 = _slicedToArray(_ref7, 1);
          rows = _ref8[0];
          res.json(rows);
          _context4.next = 16;
          break;

        case 12:
          _context4.prev = 12;
          _context4.t0 = _context4["catch"](0);
          console.error('Get products error:', _context4.t0);
          res.status(500).json({
            error: 'Failed to fetch products'
          });

        case 16:
        case "end":
          return _context4.stop();
      }
    }
  }, null, null, [[0, 12]]);
});
app.post('/api/products', function _callee4(req, res) {
  var _req$body3, name, sku, category, description, _req$body3$price, price, db, _ref9, _ref10, result, _ref11, _ref12, rows;

  return regeneratorRuntime.async(function _callee4$(_context5) {
    while (1) {
      switch (_context5.prev = _context5.next) {
        case 0:
          _context5.prev = 0;
          _req$body3 = req.body, name = _req$body3.name, sku = _req$body3.sku, category = _req$body3.category, description = _req$body3.description, _req$body3$price = _req$body3.price, price = _req$body3$price === void 0 ? 0 : _req$body3$price;

          if (!(!name || !sku)) {
            _context5.next = 4;
            break;
          }

          return _context5.abrupt("return", res.status(400).json({
            error: 'Name and SKU are required'
          }));

        case 4:
          _context5.next = 6;
          return regeneratorRuntime.awrap(getPool());

        case 6:
          db = _context5.sent;
          _context5.next = 9;
          return regeneratorRuntime.awrap(db.query('INSERT INTO products (name, sku, category, description, price, effective_date) VALUES (?, ?, ?, ?, ?, NOW())', [name, sku, category || 'General', description || name, Number(price)]));

        case 9:
          _ref9 = _context5.sent;
          _ref10 = _slicedToArray(_ref9, 1);
          result = _ref10[0];
          _context5.next = 14;
          return regeneratorRuntime.awrap(db.query('SELECT * FROM products WHERE id = ?', [result.insertId]));

        case 14:
          _ref11 = _context5.sent;
          _ref12 = _slicedToArray(_ref11, 1);
          rows = _ref12[0];
          res.status(201).json(rows[0]);
          _context5.next = 26;
          break;

        case 20:
          _context5.prev = 20;
          _context5.t0 = _context5["catch"](0);
          console.error('Add product error:', _context5.t0);

          if (!(_context5.t0.code === 'ER_DUP_ENTRY')) {
            _context5.next = 25;
            break;
          }

          return _context5.abrupt("return", res.status(409).json({
            error: 'SKU already exists'
          }));

        case 25:
          res.status(500).json({
            error: 'Failed to add product'
          });

        case 26:
        case "end":
          return _context5.stop();
      }
    }
  }, null, null, [[0, 20]]);
}); // ======================== PRICE UPDATE ROUTE ========================

app.post('/api/prices/update', function _callee5(req, res) {
  var _req$body4, productId, newPrice, reason, db, _ref13, _ref14, rows, product, _ref15, _ref16, updated;

  return regeneratorRuntime.async(function _callee5$(_context6) {
    while (1) {
      switch (_context6.prev = _context6.next) {
        case 0:
          _context6.prev = 0;
          _req$body4 = req.body, productId = _req$body4.productId, newPrice = _req$body4.newPrice, reason = _req$body4.reason;
          _context6.next = 4;
          return regeneratorRuntime.awrap(getPool());

        case 4:
          db = _context6.sent;
          _context6.next = 7;
          return regeneratorRuntime.awrap(db.query('SELECT * FROM products WHERE id = ?', [Number(productId)]));

        case 7:
          _ref13 = _context6.sent;
          _ref14 = _slicedToArray(_ref13, 1);
          rows = _ref14[0];

          if (!(rows.length === 0)) {
            _context6.next = 12;
            break;
          }

          return _context6.abrupt("return", res.status(404).json({
            error: 'Product not found'
          }));

        case 12:
          product = rows[0]; // Save old price to history

          _context6.next = 15;
          return regeneratorRuntime.awrap(db.query('INSERT INTO price_history (product_id, old_price, new_price, reason) VALUES (?, ?, ?, ?)', [product.id, product.price, Number(newPrice), reason || 'Price update']));

        case 15:
          _context6.next = 17;
          return regeneratorRuntime.awrap(db.query('UPDATE products SET price = ?, last_reason = ?, effective_date = NOW() WHERE id = ?', [Number(newPrice), reason || 'Price update', Number(productId)]));

        case 17:
          _context6.next = 19;
          return regeneratorRuntime.awrap(db.query('SELECT * FROM products WHERE id = ?', [Number(productId)]));

        case 19:
          _ref15 = _context6.sent;
          _ref16 = _slicedToArray(_ref15, 1);
          updated = _ref16[0];
          io.emit('price-updated', {
            productId: Number(productId),
            newPrice: Number(newPrice),
            reason: reason || 'Price update'
          });
          res.json({
            success: true,
            product: updated[0]
          });
          _context6.next = 30;
          break;

        case 26:
          _context6.prev = 26;
          _context6.t0 = _context6["catch"](0);
          console.error('Price update error:', _context6.t0);
          res.status(500).json({
            error: 'Failed to update price'
          });

        case 30:
        case "end":
          return _context6.stop();
      }
    }
  }, null, null, [[0, 26]]);
}); // ======================== SYNC ROUTE ========================

app.post('/api/sync/pull', function _callee6(_req, res) {
  var db, _ref17, _ref18, products;

  return regeneratorRuntime.async(function _callee6$(_context7) {
    while (1) {
      switch (_context7.prev = _context7.next) {
        case 0:
          _context7.prev = 0;
          _context7.next = 3;
          return regeneratorRuntime.awrap(getPool());

        case 3:
          db = _context7.sent;
          _context7.next = 6;
          return regeneratorRuntime.awrap(db.query('SELECT * FROM products ORDER BY created_at DESC'));

        case 6:
          _ref17 = _context7.sent;
          _ref18 = _slicedToArray(_ref17, 1);
          products = _ref18[0];
          // Track sync count (in-memory is fine; or add a syncs table if persistence is needed)
          res.json({
            success: true,
            totalProducts: products.length,
            products: products
          });
          _context7.next = 16;
          break;

        case 12:
          _context7.prev = 12;
          _context7.t0 = _context7["catch"](0);
          console.error('Sync error:', _context7.t0);
          res.status(500).json({
            error: 'Sync failed'
          });

        case 16:
        case "end":
          return _context7.stop();
      }
    }
  }, null, null, [[0, 12]]);
}); // ======================== ADMIN ROUTES ========================

app.get('/api/admin/stats', function _callee7(_req, res) {
  var db, _ref19, _ref20, _ref20$, totalUsers, _ref21, _ref22, _ref22$, totalProducts, _ref23, _ref24, _ref24$, successfulSyncs;

  return regeneratorRuntime.async(function _callee7$(_context8) {
    while (1) {
      switch (_context8.prev = _context8.next) {
        case 0:
          _context8.prev = 0;
          _context8.next = 3;
          return regeneratorRuntime.awrap(getPool());

        case 3:
          db = _context8.sent;
          _context8.next = 6;
          return regeneratorRuntime.awrap(db.query('SELECT COUNT(*) AS totalUsers FROM users'));

        case 6:
          _ref19 = _context8.sent;
          _ref20 = _slicedToArray(_ref19, 1);
          _ref20$ = _slicedToArray(_ref20[0], 1);
          totalUsers = _ref20$[0].totalUsers;
          _context8.next = 12;
          return regeneratorRuntime.awrap(db.query('SELECT COUNT(*) AS totalProducts FROM products'));

        case 12:
          _ref21 = _context8.sent;
          _ref22 = _slicedToArray(_ref21, 1);
          _ref22$ = _slicedToArray(_ref22[0], 1);
          totalProducts = _ref22$[0].totalProducts;
          _context8.next = 18;
          return regeneratorRuntime.awrap(db.query('SELECT COUNT(*) AS successfulSyncs FROM price_history'));

        case 18:
          _ref23 = _context8.sent;
          _ref24 = _slicedToArray(_ref23, 1);
          _ref24$ = _slicedToArray(_ref24[0], 1);
          successfulSyncs = _ref24$[0].successfulSyncs;
          res.json({
            totalUsers: totalUsers,
            totalProducts: totalProducts,
            successfulSyncs: successfulSyncs
          });
          _context8.next = 29;
          break;

        case 25:
          _context8.prev = 25;
          _context8.t0 = _context8["catch"](0);
          console.error('Stats error:', _context8.t0);
          res.status(500).json({
            error: 'Failed to fetch stats'
          });

        case 29:
        case "end":
          return _context8.stop();
      }
    }
  }, null, null, [[0, 25]]);
});
app.get('/api/admin/users', function _callee8(_req, res) {
  var db, _ref25, _ref26, rows;

  return regeneratorRuntime.async(function _callee8$(_context9) {
    while (1) {
      switch (_context9.prev = _context9.next) {
        case 0:
          _context9.prev = 0;
          _context9.next = 3;
          return regeneratorRuntime.awrap(getPool());

        case 3:
          db = _context9.sent;
          _context9.next = 6;
          return regeneratorRuntime.awrap(db.query('SELECT id, username, email, role, created_at FROM users'));

        case 6:
          _ref25 = _context9.sent;
          _ref26 = _slicedToArray(_ref25, 1);
          rows = _ref26[0];
          res.json(rows);
          _context9.next = 16;
          break;

        case 12:
          _context9.prev = 12;
          _context9.t0 = _context9["catch"](0);
          console.error('Get users error:', _context9.t0);
          res.status(500).json({
            error: 'Failed to fetch users'
          });

        case 16:
        case "end":
          return _context9.stop();
      }
    }
  }, null, null, [[0, 12]]);
});
app["delete"]('/api/admin/users/:id', function _callee9(req, res) {
  var userId, db, _ref27, _ref28, rows;

  return regeneratorRuntime.async(function _callee9$(_context10) {
    while (1) {
      switch (_context10.prev = _context10.next) {
        case 0:
          _context10.prev = 0;
          userId = Number(req.params.id);
          _context10.next = 4;
          return regeneratorRuntime.awrap(getPool());

        case 4:
          db = _context10.sent;
          _context10.next = 7;
          return regeneratorRuntime.awrap(db.query('SELECT * FROM users WHERE id = ?', [userId]));

        case 7:
          _ref27 = _context10.sent;
          _ref28 = _slicedToArray(_ref27, 1);
          rows = _ref28[0];

          if (!(rows.length === 0)) {
            _context10.next = 12;
            break;
          }

          return _context10.abrupt("return", res.status(404).json({
            error: 'User not found'
          }));

        case 12:
          _context10.next = 14;
          return regeneratorRuntime.awrap(db.query('DELETE FROM users WHERE id = ?', [userId]));

        case 14:
          res.json({
            success: true,
            removedUser: rows[0]
          });
          _context10.next = 21;
          break;

        case 17:
          _context10.prev = 17;
          _context10.t0 = _context10["catch"](0);
          console.error('Delete user error:', _context10.t0);
          res.status(500).json({
            error: 'Failed to delete user'
          });

        case 21:
        case "end":
          return _context10.stop();
      }
    }
  }, null, null, [[0, 17]]);
}); // ======================== SOCKET ========================

io.on('connection', function () {}); // ======================== START SERVER ========================

function startServer() {
  var port = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 5000;
  return new Promise(function (resolve) {
    var listener = server.listen(port, function () {
      return resolve({
        server: server,
        port: listener.address().port
      });
    });
  });
}

function stopServer(serverInstance) {
  return new Promise(function (resolve, reject) {
    if (!serverInstance) return resolve();
    serverInstance.close(function (error) {
      return error ? reject(error) : resolve();
    });
  });
}

if (require.main === module) {
  var PORT = process.env.PORT || 5000;
  getPool().then(function () {
    server.listen(PORT, function () {
      return console.log("\uD83D\uDE80 API server running at http://localhost:".concat(PORT));
    });
  })["catch"](function (err) {
    console.error('❌ Failed to connect to database:', err.message);
    console.error('Make sure XAMPP MySQL is running and the database exists.');
    process.exit(1);
  });
}

module.exports = {
  startServer: startServer,
  stopServer: stopServer
};