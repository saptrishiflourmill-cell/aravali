const Visitor = require('../models/Visitor');

function authenticateVisitor(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const token = auth.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Invalid token format' });

  const visitor = Visitor.findByToken(token);
  if (!visitor) return res.status(401).json({ error: 'Invalid or expired token' });

  req.visitor = visitor;
  next();
}

function optionalVisitor(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth) { req.visitor = null; return next(); }

  const token = auth.split(' ')[1];
  if (!token) { req.visitor = null; return next(); }

  const visitor = Visitor.findByToken(token);
  req.visitor = visitor || null;
  next();
}

module.exports = { authenticateVisitor, optionalVisitor };
