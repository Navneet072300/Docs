require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createClient } = require('redis');
const { query } = require('./db');
const { setupWSConnection, setupRedis } = require('./services/collab');

const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const commentRoutes = require('./routes/comments');

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/documents/:docId/comments', commentRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', async (ws, req, { docId, user }) => {
  try {
    // Verify user has access to document
    const doc = await query('SELECT * FROM documents WHERE id = $1', [docId]);
    if (doc.rows.length === 0) return ws.close(1008, 'Document not found');

    const d = doc.rows[0];
    if (d.owner_id !== user.id && !d.is_public) {
      const collab = await query(
        'SELECT * FROM document_collaborators WHERE document_id = $1 AND user_id = $2',
        [docId, user.id]
      );
      if (collab.rows.length === 0) return ws.close(1008, 'Access denied');
    }

    await setupWSConnection(ws, docId, user.id, user.name, user.avatar_color || '#4f46e5');
  } catch (err) {
    console.error('WS setup error:', err);
    ws.close(1011, 'Server error');
  }
});

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathMatch = url.pathname.match(/^\/collab\/(.+)$/);
  if (!pathMatch) return socket.destroy();

  const docId = pathMatch[1];
  const token = url.searchParams.get('token');

  if (!token) return socket.destroy();

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, { docId, user });
    });
  } catch {
    socket.destroy();
  }
});

const startRedis = async () => {
  try {
    const pub = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    const sub = pub.duplicate();
    await pub.connect();
    await sub.connect();
    setupRedis(pub, sub);
    console.log('Redis connected');
  } catch (err) {
    console.warn('Redis not available, running without pub/sub:', err.message);
  }
};

const initDb = async () => {
  const fs = require('fs');
  const schema = fs.readFileSync(__dirname + '/db/schema.sql', 'utf8');
  await query(schema);
  console.log('Database initialized');
};

const PORT = process.env.PORT || 3001;
(async () => {
  await initDb();
  await startRedis();
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})();
