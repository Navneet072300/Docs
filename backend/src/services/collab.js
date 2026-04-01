const Y = require('yjs');
const syncProtocol = require('y-protocols/sync');
const awarenessProtocol = require('y-protocols/awareness');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');
const { query } = require('../db');

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

// In-memory store: docId -> { ydoc, awareness, conns: Map<ws, {userId, name, color}> }
const docs = new Map();

let redisPublisher = null;
let redisSubscriber = null;

const setupRedis = (pub, sub) => {
  redisPublisher = pub;
  redisSubscriber = sub;

  redisSubscriber.pSubscribe('ydoc:*', (message, channel) => {
    const docId = channel.replace('ydoc:', '');
    const entry = docs.get(docId);
    if (!entry) return;

    const update = Buffer.from(message, 'base64');
    Y.applyUpdate(entry.ydoc, update, 'redis');
  });
};

const getDoc = (docId) => {
  if (!docs.has(docId)) {
    const ydoc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(ydoc);
    docs.set(docId, { ydoc, awareness, conns: new Map() });
  }
  return docs.get(docId);
};

const send = (ws, data) => {
  if (ws.readyState === 1) ws.send(data);
};

const broadcastMessage = (entry, message, origin) => {
  entry.conns.forEach((_, conn) => {
    if (conn !== origin) send(conn, message);
  });
};

const persistDoc = async (docId, ydoc) => {
  try {
    const state = Buffer.from(Y.encodeStateAsUpdate(ydoc));
    await query(
      'UPDATE documents SET ydoc_state = $1, updated_at = NOW() WHERE id = $2',
      [state, docId]
    );
  } catch (err) {
    console.error('Error persisting doc:', err);
  }
};

const loadDoc = async (docId) => {
  try {
    const result = await query('SELECT ydoc_state FROM documents WHERE id = $1', [docId]);
    if (result.rows.length > 0 && result.rows[0].ydoc_state) {
      const entry = getDoc(docId);
      Y.applyUpdate(entry.ydoc, result.rows[0].ydoc_state);
    }
  } catch (err) {
    console.error('Error loading doc:', err);
  }
};

const setupWSConnection = async (ws, docId, userId, userName, userColor) => {
  const entry = getDoc(docId);

  // Load from DB if first connection
  if (entry.conns.size === 0) {
    await loadDoc(docId);
  }

  entry.conns.set(ws, { userId, name: userName, color: userColor });

  // Send sync step 1
  {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(enc, entry.ydoc);
    send(ws, encoding.toUint8Array(enc));
  }

  // Send current awareness states
  const awarenessStates = entry.awareness.getStates();
  if (awarenessStates.size > 0) {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      enc,
      awarenessProtocol.encodeAwarenessUpdate(entry.awareness, Array.from(awarenessStates.keys()))
    );
    send(ws, encoding.toUint8Array(enc));
  }

  // Handle ydoc updates -> broadcast to all OTHER peers + Redis
  // origin is the transactionOrigin passed to readSyncMessage (the sender's ws).
  // We must NOT skip when origin === ws — that would prevent broadcasting client edits.
  // Instead, broadcastMessage already excludes the origin connection.
  const updateHandler = (update, origin) => {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MESSAGE_SYNC);
    syncProtocol.writeUpdate(enc, update);
    const msg = encoding.toUint8Array(enc);

    // Send to every connected client except the one that produced this update
    entry.conns.forEach((_, conn) => {
      if (conn !== origin && conn.readyState === 1) send(conn, msg);
    });

    // Propagate to other server instances via Redis (skip if update came from Redis)
    if (redisPublisher && origin !== 'redis') {
      redisPublisher.publish(`ydoc:${docId}`, Buffer.from(update).toString('base64'));
    }
  };
  entry.ydoc.on('update', updateHandler);

  // Handle awareness changes -> broadcast to peers
  const awarenessChangeHandler = ({ added, updated, removed }, origin) => {
    const changedClients = [...added, ...updated, ...removed];
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      enc,
      awarenessProtocol.encodeAwarenessUpdate(entry.awareness, changedClients)
    );
    broadcastMessage(entry, encoding.toUint8Array(enc), origin);
  };
  entry.awareness.on('change', awarenessChangeHandler);

  // Debounced persist
  let persistTimer = null;
  const schedulePersist = () => {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => persistDoc(docId, entry.ydoc), 3000);
  };
  entry.ydoc.on('update', schedulePersist);

  ws.on('message', (rawMsg) => {
    try {
      const dec = decoding.createDecoder(new Uint8Array(rawMsg));
      const msgType = decoding.readVarUint(dec);

      if (msgType === MESSAGE_SYNC) {
        const enc = encoding.createEncoder();
        encoding.writeVarUint(enc, MESSAGE_SYNC);
        const hasReply = syncProtocol.readSyncMessage(dec, enc, entry.ydoc, ws);
        if (encoding.length(enc) > 1) {
          send(ws, encoding.toUint8Array(enc));
        }
      } else if (msgType === MESSAGE_AWARENESS) {
        awarenessProtocol.applyAwarenessUpdate(
          entry.awareness,
          decoding.readVarUint8Array(dec),
          ws
        );
      }
    } catch (err) {
      console.error('WS message error:', err);
    }
  });

  ws.on('close', () => {
    entry.conns.delete(ws);
    entry.ydoc.off('update', updateHandler);
    entry.ydoc.off('update', schedulePersist);
    entry.awareness.off('change', awarenessChangeHandler);
    awarenessProtocol.removeAwarenessStates(entry.awareness, [entry.ydoc.clientID], 'close');

    if (entry.conns.size === 0) {
      persistDoc(docId, entry.ydoc);
      docs.delete(docId);
    }
  });

  ws.on('error', (err) => console.error('WS error:', err));
};

// Broadcast connected users count
const getPresence = (docId) => {
  const entry = docs.get(docId);
  if (!entry) return [];
  return Array.from(entry.conns.values());
};

module.exports = { setupWSConnection, setupRedis, getPresence };
