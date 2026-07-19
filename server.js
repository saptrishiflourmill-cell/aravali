const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
const { initDb } = require('./database/db');
const ticketRoutes = require('./routes/tickets');
const paymentRoutes = require('./routes/payments');
const authRoutes = require('./routes/auth');
const Ticket = require('./models/Ticket');

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const DATA_DIR = process.env.DATA_DIR || __dirname;

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads')));
app.use('/qrcodes', express.static(path.join(DATA_DIR, 'qrcodes')));

app.use('/api/tickets', ticketRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/auth', authRoutes);

app.get('/ticket/:ticketId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pass.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/config', (req, res) => {
  const totalTickets = Ticket.count();
  const freePromoActive = totalTickets < 3;
  res.json({
    status: 'ok',
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    pricing: {
      freePromoActive,
      remainingFree: Math.max(0, 3 - totalTickets),
      totalTickets,
      paidAmount: 1000,
      paidAmountDisplay: '₹10',
    }
  });
});

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'API endpoint not found' });
  } else {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await initDb();
    console.log('Database initialized');

    http.createServer(app).listen(PORT, '0.0.0.0', () => {
      const host = process.env.HOST || 'localhost';
      console.log(`HTTP:  http://${host}:${PORT}`);
    });

    const certPath = path.join(__dirname, 'server.crt');
    const keyPath = path.join(__dirname, 'server.key');
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      const options = {
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath)
      };
      https.createServer(options, app).listen(HTTPS_PORT, '0.0.0.0', () => {
        const host = process.env.HOST || '192.168.1.192';
        console.log(`HTTPS: https://${host}:${HTTPS_PORT}`);
        console.log('');
        console.log('Open the HTTPS link on your phone for camera access.');
        console.log('Your browser will show a warning - tap "Advanced" then "Proceed anyway".');
      });
    }
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
