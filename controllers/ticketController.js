const Ticket = require('../models/Ticket');
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

exports.getStats = (req, res) => {
  try {
    const stats = Ticket.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAll = (req, res) => {
  try {
    const { search, date, page, limit } = req.query;
    const result = Ticket.getAll({
      search: search || '',
      date: date || '',
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getById = (req, res) => {
  try {
    const { id } = req.params;
    const ticket = Ticket.getByTicketId(id) || Ticket.getById(parseInt(id));
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    ticket.ticketUrl = `${getBaseUrl()}/ticket/${ticket.ticketId}`;
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.purchase = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const data = {
      fullName: req.body.fullName,
      email: '',
      phone: req.body.phone,
      ticketType: req.body.ticketType || 'General',
      eventDate: req.body.eventDate,
      visitorId: req.visitor ? req.visitor.id : null
    };

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

    res.status(201).json({
      ticket: {
        ...ticket,
        qrToken: undefined
      },
      qrCodeUrl: `/qrcodes/${ticket.ticketId}.png`,
      qrData,
      ticketUrl: `${getBaseUrl()}/ticket/${ticket.ticketId}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.scanTicket = (req, res) => {
  try {
    const { id } = req.params;
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Verification token required' });
    }

    const result = Ticket.verifyAndUse(id, token);

    if (!result.valid) {
      return res.status(409).json({
        valid: false,
        reason: result.reason,
        usedAt: result.usedAt
      });
    }

    const ticket = result.ticket;
    res.json({
      valid: true,
      message: 'Ticket verified. Welcome!',
      ticket: {
        ticketId: ticket.ticketId,
        fullName: ticket.fullName,
        email: ticket.email,
        ticketType: ticket.ticketType,
        eventDate: ticket.eventDate,
        status: ticket.status,
        usedAt: ticket.usedAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getQRCode = async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = Ticket.getByTicketId(id) || Ticket.getById(parseInt(id));
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const qrData = `${getBaseUrl()}/api/tickets/verify/${ticket.ticketId}?token=${ticket.qrToken}`;
    const qrPath = path.join(qrDir, `${ticket.ticketId}.png`);

    if (!fs.existsSync(qrPath)) {
      await QRCode.toFile(qrPath, qrData, {
        width: 300,
        margin: 2,
        color: { dark: '#1e293b', light: '#ffffff' }
      });
    }

    res.download(qrPath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = (req, res) => {
  try {
    const { id } = req.params;
    const data = {
      fullName: req.body.fullName,
      email: req.body.email,
      phone: req.body.phone,
      ticketType: req.body.ticketType,
      eventDate: req.body.eventDate
    };

    const ticket = Ticket.update(parseInt(id), data);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMyTickets = (req, res) => {
  try {
    const visitorId = req.visitor.id;
    const tickets = Ticket.findByVisitor(visitorId);
    res.json({ tickets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = (req, res) => {
  try {
    const { id } = req.params;
    const deleted = Ticket.delete(parseInt(id));
    if (!deleted) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json({ message: 'Ticket deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
