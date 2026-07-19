const { getDb, saveDb } = require('../database/db');
const crypto = require('crypto');

function queryAll(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function execute(sql, params = []) {
  const db = getDb();
  db.run(sql, params);
  saveDb();
}

function generateQrToken() {
  return crypto.randomBytes(16).toString('hex');
}

function getNextTicketId() {
  const row = queryOne('SELECT COUNT(*) as count FROM tickets');
  const num = (row ? row.count : 0) + 1;
  return 'TKT-' + String(num).padStart(6, '0');
}

class Ticket {
  static getAll({ search, date, page = 1, limit = 10 }) {
    const offset = (page - 1) * limit;
    const whereClauses = [];
    const params = [];

    if (search) {
      whereClauses.push('(fullName LIKE ? OR email LIKE ? OR phone LIKE ? OR ticketId LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    if (date) {
      whereClauses.push('eventDate = ?');
      params.push(date);
    }

    const where = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
    const countRow = queryOne(`SELECT COUNT(*) as total FROM tickets ${where}`, params);
    const total = countRow ? countRow.total : 0;
    const totalPages = Math.ceil(total / limit);

    const tickets = queryAll(
      `SELECT * FROM tickets ${where} ORDER BY purchaseDate DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return { tickets, total, page, totalPages, limit };
  }

  static getById(id) {
    return queryOne('SELECT * FROM tickets WHERE id = ?', [id]);
  }

  static getByTicketId(ticketId) {
    return queryOne('SELECT * FROM tickets WHERE ticketId = ?', [ticketId]);
  }

  static findByVisitor(visitorId) {
    return queryAll('SELECT * FROM tickets WHERE visitorId = ? ORDER BY purchaseDate DESC', [visitorId]);
  }

  static findByEmail(email) {
    return queryAll('SELECT * FROM tickets WHERE email = ? ORDER BY purchaseDate DESC', [email]);
  }

  static create(data) {
    const ticketId = data.ticketId || getNextTicketId();
    const qrToken = generateQrToken();
    execute(
      `INSERT INTO tickets (ticketId, fullName, email, phone, ticketType, eventDate, price, quantity, qrToken, status, purchaseDate, createdAt, updatedAt, visitorId, reference)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', datetime('now'), datetime('now'), datetime('now'), ?, ?)`,
      [
        ticketId,
        data.fullName,
        data.email,
        data.phone,
        data.ticketType || 'General',
        data.eventDate,
        data.price || 0,
        data.quantity || 1,
        qrToken,
        data.visitorId || null,
        data.reference || ''
      ]
    );
    return this.getByTicketId(ticketId);
  }

  static update(id, data) {
    const existing = this.getById(id);
    if (!existing) return null;

    execute(
      `UPDATE tickets SET fullName = ?, email = ?, phone = ?, ticketType = ?, eventDate = ?, reference = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        data.fullName || existing.fullName,
        data.email || existing.email,
        data.phone || existing.phone,
        data.ticketType || existing.ticketType,
        data.eventDate || existing.eventDate,
        data.reference !== undefined ? data.reference : (existing.reference || ''),
        id
      ]
    );
    return this.getById(id);
  }

  static linkToVisitor(ticketId, visitorId) {
    const ticket = this.getByTicketId(ticketId);
    if (!ticket) return null;
    execute('UPDATE tickets SET visitorId = ?, updatedAt = datetime(\'now\') WHERE id = ?', [visitorId, ticket.id]);
    return this.getById(ticket.id);
  }

  static delete(id) {
    const existing = this.getById(id);
    if (!existing) return false;
    execute('DELETE FROM tickets WHERE id = ?', [id]);
    return true;
  }

  static verifyAndUse(ticketId, qrToken) {
    const ticket = this.getByTicketId(ticketId);
    if (!ticket) {
      return { valid: false, reason: 'Ticket not found' };
    }
    if (ticket.qrToken !== qrToken) {
      return { valid: false, reason: 'Invalid QR code' };
    }
    if (ticket.status === 'Used') {
      return { valid: false, reason: 'Ticket already used', usedAt: ticket.usedAt };
    }
    if (ticket.status === 'Cancelled') {
      return { valid: false, reason: 'Ticket has been cancelled' };
    }

    execute(
      "UPDATE tickets SET status = 'Used', usedAt = datetime('now'), updatedAt = datetime('now') WHERE id = ?",
      [ticket.id]
    );
    return { valid: true, ticket: this.getById(ticket.id) };
  }

  static count() {
    const row = queryOne('SELECT COUNT(*) as count FROM tickets');
    return row ? row.count : 0;
  }

  static getStats() {
    const total = queryOne('SELECT COUNT(*) as count FROM tickets');
    const active = queryOne("SELECT COUNT(*) as count FROM tickets WHERE status = 'Active'");
    const used = queryOne("SELECT COUNT(*) as count FROM tickets WHERE status = 'Used'");
    const today = queryOne("SELECT COUNT(*) as count FROM tickets WHERE eventDate = date('now')");
    return {
      total: total ? total.count : 0,
      active: active ? active.count : 0,
      used: used ? used.count : 0,
      today: today ? today.count : 0
    };
  }
}

module.exports = Ticket;
