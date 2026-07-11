CREATE TABLE IF NOT EXISTS visitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitorId TEXT UNIQUE NOT NULL,
  fullName TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT DEFAULT '',
  address TEXT NOT NULL,
  company TEXT NOT NULL,
  personToMeet TEXT NOT NULL,
  purpose TEXT NOT NULL,
  entryDate TEXT NOT NULL,
  entryTime TEXT NOT NULL,
  exitTime TEXT DEFAULT '',
  vehicleNumber TEXT DEFAULT '',
  photo TEXT DEFAULT '',
  status TEXT DEFAULT 'Active' CHECK(status IN ('Active','Checked Out')),
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  token TEXT
);
