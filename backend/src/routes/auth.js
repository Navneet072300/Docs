const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const COLORS = ['#4f46e5','#0891b2','#059669','#d97706','#dc2626','#7c3aed','#db2777'];

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'All fields required' });

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already in use' });

    const hash = await bcrypt.hash(password, 10);
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const result = await query(
      'INSERT INTO users (email, password_hash, name, avatar_color) VALUES ($1,$2,$3,$4) RETURNING id, email, name, avatar_color',
      [email, hash, name, color]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, avatar_color: user.avatar_color }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, avatar_color: user.avatar_color }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, avatar_color: user.avatar_color } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT id, email, name, avatar_color, created_at FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
