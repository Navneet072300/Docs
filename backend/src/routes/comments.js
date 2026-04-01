const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT c.*, u.name as user_name, u.avatar_color as user_color
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.document_id = $1 AND c.parent_id IS NULL
      ORDER BY c.created_at DESC
    `, [req.params.docId]);

    const comments = result.rows;
    for (const comment of comments) {
      const replies = await query(`
        SELECT c.*, u.name as user_name, u.avatar_color as user_color
        FROM comments c JOIN users u ON u.id = c.user_id
        WHERE c.parent_id = $1 ORDER BY c.created_at ASC
      `, [comment.id]);
      comment.replies = replies.rows;
    }
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { content, selection_text, parent_id } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });

    const result = await query(
      'INSERT INTO comments (document_id, user_id, content, selection_text, parent_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.params.docId, req.user.id, content, selection_text, parent_id || null]
    );
    const comment = result.rows[0];
    const user = await query('SELECT name, avatar_color FROM users WHERE id = $1', [req.user.id]);
    res.status(201).json({ ...comment, user_name: user.rows[0].name, user_color: user.rows[0].avatar_color, replies: [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:commentId', authenticate, async (req, res) => {
  try {
    const { content, resolved } = req.body;
    const comment = await query('SELECT * FROM comments WHERE id = $1', [req.params.commentId]);
    if (comment.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (comment.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const result = await query(
      'UPDATE comments SET content = COALESCE($1, content), resolved = COALESCE($2, resolved), updated_at = NOW() WHERE id = $3 RETURNING *',
      [content, resolved, req.params.commentId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:commentId', authenticate, async (req, res) => {
  try {
    const comment = await query('SELECT user_id FROM comments WHERE id = $1', [req.params.commentId]);
    if (comment.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (comment.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    await query('DELETE FROM comments WHERE id = $1', [req.params.commentId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
