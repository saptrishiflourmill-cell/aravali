const Razorpay = require('razorpay');
const crypto = require('crypto');
const Ticket = require('../models/Ticket');
const Visitor = require('../models/Visitor');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { validationResult } = require('express-validator');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..');
const qrDir = path.join(DATA_DIR, 'qrcodes');
if (!fs.existsSync(qrDir)) {
  fs.mkdirSync(qrDir, { recursive: true });
}

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const HOST = process.env.HOST || getLocalIp();
const PORT = process.env.PORT || 3000;

function getBaseUrl() {
  return `http://${HOST}:${PORT}`;
}

let razorpay = null;
try {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
} catch (e) {
  console.warn('Razorpay not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
}

exports.createOrder = async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(503).json({
        error: 'Payment gateway not configured. Admin must set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
        setupRequired: true
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const options = {
      amount: 100,
      currency: 'INR',
      receipt: 'tkt-' + Date.now(),
      payment_capture: 1,
    };

    const order = await razorpay.orders.create(options);

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      fullName: req.body.fullName,
      email: req.body.email,
      phone: req.body.phone,
      eventDate: req.body.eventDate,
    });
  } catch (err) {
    console.error('Razorpay order error:', err);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(503).json({ error: 'Payment gateway not configured' });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      fullName,
      email,
      phone,
      eventDate,
    } = req.body;

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    const visitorToken = req.body.visitorToken;
    let visitorId = null;
    if (visitorToken) {
      const visitor = Visitor.findByToken(visitorToken);
      if (visitor) visitorId = visitor.id;
    }

    const data = { fullName, email, phone, eventDate, visitorId };
    const ticket = Ticket.create(data);

    const qrData = `${getBaseUrl()}/api/tickets/verify/${ticket.ticketId}?token=${ticket.qrToken}`;
    const qrPath = path.join(qrDir, `${ticket.ticketId}.png`);

    try {
      await QRCode.toFile(qrPath, qrData, {
        width: 300,
        margin: 2,
        color: { dark: '#1e293b', light: '#ffffff' }
      });
    } catch (qrErr) {
      console.error('QR generation error:', qrErr);
    }

    res.json({
      success: true,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      ticket: {
        ...ticket,
        qrToken: undefined,
      },
      qrCodeUrl: `/qrcodes/${ticket.ticketId}.png`,
      qrData,
      ticketUrl: `${getBaseUrl()}/ticket/${ticket.ticketId}`,
    });
  } catch (err) {
    console.error('Payment verification error:', err);
    res.status(500).json({ error: 'Failed to process payment' });
  }
};
