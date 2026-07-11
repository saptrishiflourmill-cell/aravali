const crypto = require('crypto');
const { getDb, saveDb } = require('../database/db');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

exports.login = (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const db = getDb();
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  stmt.bind([username]);
  const user = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();

  if (!user || user.password !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = crypto.randomUUID();
  const updateStmt = db.prepare('UPDATE users SET token = ? WHERE id = ?');
  updateStmt.run([token, user.id]);
  updateStmt.free();
  saveDb();

  res.json({ token, username: user.username, role: user.role });
};

exports.logout = (req, res) => {
  const auth = req.headers['authorization'];
  if (!auth) return res.json({ message: 'ok' });

  const token = auth.split(' ')[1];
  if (token) {
    const db = getDb();
    const stmt = db.prepare('UPDATE users SET token = NULL WHERE token = ?');
    stmt.run([token]);
    stmt.free();
    saveDb();
  }

  res.json({ message: 'Logged out' });
};

exports.check = (req, res) => {
  const auth = req.headers['authorization'];
  if (!auth) return res.json({ authenticated: false });

  const token = auth.split(' ')[1];
  if (!token) return res.json({ authenticated: false });

  const db = getDb();
  const stmt = db.prepare('SELECT username, role FROM users WHERE token = ?');
  stmt.bind([token]);
  const user = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();

  if (user) {
    res.json({ authenticated: true, username: user.username, role: user.role });
  } else {
    res.json({ authenticated: false });
  }
};
