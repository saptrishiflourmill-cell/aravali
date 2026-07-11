const { getDb } = require('../database/db');

function authenticateToken(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const token = auth.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Invalid token format' });

  const db = getDb();
  const stmt = db.prepare('SELECT id, username, role FROM users WHERE token = ?');
  stmt.bind([token]);
  const user = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();

  if (!user) return res.status(401).json({ error: 'Invalid or expired token' });

  req.user = user;
  next();
}

module.exports = { authenticateToken };
