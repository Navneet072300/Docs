const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// List documents for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT d.id, d.title, d.created_at, d.updated_at, d.is_public,
             u.name as owner_name, u.id as owner_id,
             u.avatar_color as owner_color
      FROM documents d
      JOIN users u ON d.owner_id = u.id
      WHERE d.owner_id = $1
      UNION
      SELECT d.id, d.title, d.created_at, d.updated_at, d.is_public,
             u.name as owner_name, u.id as owner_id,
             u.avatar_color as owner_color
      FROM documents d
      JOIN users u ON d.owner_id = u.id
      JOIN document_collaborators dc ON dc.document_id = d.id
      WHERE dc.user_id = $1
      ORDER BY updated_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create document
router.post('/', authenticate, async (req, res) => {
  try {
    const { title } = req.body;
    const result = await query(
      'INSERT INTO documents (title, owner_id) VALUES ($1, $2) RETURNING *',
      [title || 'Untitled document', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single document
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT d.*, u.name as owner_name, u.avatar_color as owner_color
      FROM documents d
      JOIN users u ON d.owner_id = u.id
      WHERE d.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    const doc = result.rows[0];

    // Check access
    if (doc.owner_id !== req.user.id && !doc.is_public) {
      const collab = await query(
        'SELECT * FROM document_collaborators WHERE document_id = $1 AND user_id = $2',
        [req.params.id, req.user.id]
      );
      if (collab.rows.length === 0) return res.status(403).json({ error: 'Access denied' });
    }

    // Get collaborators
    const collabResult = await query(`
      SELECT u.id, u.name, u.email, u.avatar_color, dc.permission
      FROM document_collaborators dc
      JOIN users u ON u.id = dc.user_id
      WHERE dc.document_id = $1
    `, [req.params.id]);

    res.json({ ...doc, collaborators: collabResult.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update document title
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { title, is_public } = req.body;
    const doc = await query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (doc.rows[0].owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const updates = [];
    const values = [];
    let i = 1;
    if (title !== undefined) { updates.push(`title = $${i++}`); values.push(title); }
    if (is_public !== undefined) { updates.push(`is_public = $${i++}`); values.push(is_public); }
    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const result = await query(
      `UPDATE documents SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete document
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const doc = await query('SELECT owner_id FROM documents WHERE id = $1', [req.params.id]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (doc.rows[0].owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    await query('DELETE FROM documents WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Add collaborator
router.post('/:id/collaborators', authenticate, async (req, res) => {
  try {
    const { email, permission = 'editor' } = req.body;
    const doc = await query('SELECT owner_id FROM documents WHERE id = $1', [req.params.id]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (doc.rows[0].owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const user = await query('SELECT id, name, email, avatar_color FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    await query(
      'INSERT INTO document_collaborators (document_id, user_id, permission) VALUES ($1, $2, $3) ON CONFLICT (document_id, user_id) DO UPDATE SET permission = $3',
      [req.params.id, user.rows[0].id, permission]
    );
    res.json(user.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Save version
router.post('/:id/versions', authenticate, async (req, res) => {
  try {
    const { title } = req.body;
    const doc = await query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    await query(
      'INSERT INTO document_versions (document_id, created_by, title, content, ydoc_state) VALUES ($1,$2,$3,$4,$5)',
      [req.params.id, req.user.id, title || doc.rows[0].title, doc.rows[0].content, doc.rows[0].ydoc_state]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get versions
router.get('/:id/versions', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT dv.id, dv.title, dv.created_at, u.name as created_by_name
      FROM document_versions dv
      JOIN users u ON u.id = dv.created_by
      WHERE dv.document_id = $1
      ORDER BY dv.created_at DESC
      LIMIT 50
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
