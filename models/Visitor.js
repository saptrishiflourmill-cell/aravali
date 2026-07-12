const { getDb, saveDb } = require('../database/db');
const crypto = require('crypto');

function queryOne(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

function execute(sql, params = []) {
  const db = getDb();
  db.run(sql, params);
  saveDb();
}

class Visitor {
  static findByEmail(email) {
    return queryOne('SELECT * FROM visitors WHERE email = ?', [email]);
  }

  static findByToken(token) {
    return queryOne('SELECT * FROM visitors WHERE token = ?', [token]);
  }

  static create(data) {
    execute(
      'INSERT INTO visitors (email, name) VALUES (?, ?)',
      [data.email, data.name || data.email.split('@')[0]]
    );
    return this.findByEmail(data.email);
  }

  static updateToken(id, token) {
    execute('UPDATE visitors SET token = ? WHERE id = ?', [token, id]);
    return queryOne('SELECT * FROM visitors WHERE id = ?', [id]);
  }

  static generateToken() {
    return crypto.randomUUID();
  }
}

module.exports = Visitor;
