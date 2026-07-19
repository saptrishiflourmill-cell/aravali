const initSqlJs = require('sql.js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..');
const DB_PATH = path.join(DATA_DIR, 'database', 'visitors.db');
let db = null;

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function initDb() {
  const dbDir = path.join(DATA_DIR, 'database');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.run(schema);

  const pragma = db.prepare("PRAGMA table_info(tickets)");
  const cols = [];
  while (pragma.step()) { cols.push(pragma.getAsObject()); }
  pragma.free();
  if (!cols.find(c => c.name === 'visitorId')) {
    try { db.run("ALTER TABLE tickets ADD COLUMN visitorId INTEGER REFERENCES visitors(id)"); } catch (e) {}
  }
  if (!cols.find(c => c.name === 'reference')) {
    try { db.run("ALTER TABLE tickets ADD COLUMN reference TEXT DEFAULT ''"); } catch (e) {}
  }
  if (!cols.find(c => c.name === 'price')) {
    try { db.run("ALTER TABLE tickets ADD COLUMN price INTEGER DEFAULT 0"); } catch (e) {}
  }

  const stmt = db.prepare('SELECT COUNT(*) as count FROM users');
  const exists = stmt.step() ? stmt.getAsObject() : { count: 0 };
  stmt.free();

  if (exists.count === 0) {
    const defaultUser = process.env.ADMIN_USER || 'admin';
    const defaultPass = process.env.ADMIN_PASS || 'admin123';
    const insert = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)');
    insert.run([defaultUser, hashPassword(defaultPass), 'admin']);
    insert.free();
    console.log('Default admin user created (admin/admin123)');
  }

  saveDb();
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

module.exports = { initDb, saveDb, getDb };
