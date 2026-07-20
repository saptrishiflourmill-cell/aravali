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

  static findByPhone(phone) {
    return queryOne('SELECT * FROM visitors WHERE phone = ?', [phone]);
  }

  static findByIdentifier(identifier) {
    if (identifier.includes('@')) {
      return this.findByEmail(identifier);
    }
    return this.findByPhone(identifier);
  }

  static findByToken(token) {
    return queryOne('SELECT * FROM visitors WHERE token = ?', [token]);
  }

  static create(data) {
    const email = data.email || ''
    const phone = data.phone || ''
    const name = data.name || (email ? email.split('@')[0] : phone)
    execute(
      'INSERT INTO visitors (email, phone, name) VALUES (?, ?, ?)',
      [email, phone, name]
    );
    if (email) return this.findByEmail(email);
    return this.findByPhone(phone);
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