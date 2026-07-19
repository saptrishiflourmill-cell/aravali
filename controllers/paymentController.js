const Razorpay = require('razorpay');
const crypto = require('crypto');
const Ticket = require('../models/Ticket');
const Visitor = require('../models/Visitor');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const os = require('os');

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

    const { fullName, email, phone, eventDate } = req.body;
    if (!fullName || !email || !phone || !eventDate) {
      return res.status(400).json({ error: 'All fields are required: fullName, email, phone, eventDate' });
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

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment details' });
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed - signature mismatch' });
    }

    const visitorToken = req.body.visitorToken;
    let visitorId = null;
    let visitorInfo = null;
    if (visitorToken) {
      const visitor = Visitor.findByToken(visitorToken);
      if (visitor) visitorId = visitor.id;
    } else if (email) {
      let visitor = Visitor.findByEmail(email);
      if (!visitor) {
        visitor = Visitor.create({ email, name: fullName });
      }
      visitorId = visitor.id;
      const newToken = Visitor.generateToken();
      visitor = Visitor.updateToken(visitorId, newToken);
      visitorInfo = { id: visitor.id, name: visitor.name, token: visitor.token };
    }

    const data = { fullName, email, phone, eventDate, visitorId, reference: req.body.reference || '' };
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
      visitor: visitorInfo,
    });
  } catch (err) {
    console.error('Payment verification error:', err.message, err.stack);
    console.error('RAZORPAY_KEY_SECRET present:', !!process.env.RAZORPAY_KEY_SECRET);
    res.status(500).json({ error: 'Failed to process payment. Please contact support with your payment ID.' });
  }
};

exports.completeOrder = async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(503).json({ error: 'Payment gateway not configured' });
    }

    const { orderId, fullName, email, phone, eventDate } = req.body;
    if (!orderId || !email) {
      return res.status(400).json({ error: 'Order ID and email are required' });
    }

    const order = await razorpay.orders.fetch(orderId);
    if (order.status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed', status: order.status });
    }

    const payments = await razorpay.orders.fetchPayments(orderId);
    if (!payments || payments.items.length === 0) {
      return res.status(400).json({ error: 'No payment found for this order' });
    }

    const payment = payments.items[0];
    const razorpay_payment_id = payment.id;

    let visitor = Visitor.findByEmail(email);
    if (!visitor) {
      visitor = Visitor.create({ email, name: fullName || email.split('@')[0] });
    }
    if (!visitor.token) {
      const newToken = Visitor.generateToken();
      visitor = Visitor.updateToken(visitor.id, newToken);
    }

    const data = { fullName: fullName || visitor.name, email, phone: phone || '', eventDate: eventDate || '', visitorId: visitor.id, reference: req.body.reference || '' };
    const ticket = Ticket.create(data);

    const qrData = `${getBaseUrl()}/api/tickets/verify/${ticket.ticketId}?token=${ticket.qrToken}`;
    const qrPath = path.join(qrDir, `${ticket.ticketId}.png`);
    try {
      await QRCode.toFile(qrPath, qrData, { width: 300, margin: 2, color: { dark: '#1e293b', light: '#ffffff' } });
    } catch (qrErr) {
      console.error('QR generation error:', qrErr);
    }

    res.json({
      success: true,
      paymentId: razorpay_payment_id,
      orderId,
      ticket: { ...ticket, qrToken: undefined },
      qrCodeUrl: `/qrcodes/${ticket.ticketId}.png`,
      qrData,
      ticketUrl: `${getBaseUrl()}/ticket/${ticket.ticketId}`,
      visitor: { id: visitor.id, name: visitor.name, token: visitor.token },
    });
  } catch (err) {
    console.error('Complete order error:', err.message);
    res.status(500).json({ error: 'Failed to complete order: ' + err.message });
  }
};
