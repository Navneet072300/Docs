# Docs — Real-time Collaborative Editor

A full-featured, Google Docs-style collaborative document editor built with a modern stack. Multiple users can edit the same document simultaneously with real-time cursor tracking, powered by CRDT (Conflict-free Replicated Data Types).

![Docs Editor Screenshot](image.png)

---

## Features

- **Real-time collaboration** — Multiple users edit simultaneously; changes sync instantly via CRDT (Yjs)
- **Live cursors** — See every collaborator's cursor and name in real time
- **Rich text editor** — Full formatting toolbar: headings, bold/italic/underline/strikethrough, text color, highlight, alignment, lists, checklists, tables, links, images, code blocks, blockquotes, subscript/superscript
- **Menu bar** — Fully functional File, Edit, View, Insert, Format, and Tools menus with submenus and keyboard shortcuts
- **Inline bubble menu** — Quick formatting on text selection
- **Comments** — Threaded comments with replies, resolve/reopen, delete
- **Document sharing** — Add collaborators by email, toggle public/private access
- **Auto-save** — Changes are debounced and persisted to PostgreSQL every 3 seconds
- **Version history** — Save named snapshots of documents
- **Word count** — Live word and character count
- **Download** — Export as plain text or HTML
- **Authentication** — JWT-based register/login with per-user avatar colors

---

## Tech Stack

### Frontend

| Layer | Technology | Purpose |
|---|---|---|
| Framework | **Next.js 14** (App Router) | SSR, routing, React Server Components |
| Language | **TypeScript** | End-to-end type safety |
| Editor | **Tiptap v2** (ProseMirror) | Extensible rich-text editor engine |
| CRDT | **Yjs** | Conflict-free real-time document sync |
| Collaboration | **y-websocket** (client) | WebSocket provider that binds Yjs to the server |
| Cursor tracking | **@tiptap/extension-collaboration-cursor** | Shows other users' cursors with names/colors |
| Styling | **Tailwind CSS v3** | Utility-first CSS |
| Icons | **Lucide React** | Icon library |
| HTTP client | **Axios** | REST API calls with JWT interceptor |

**Tiptap extensions in use:**

```
starter-kit · collaboration · collaboration-cursor · underline
text-align · highlight · color · text-style · font-family
link · image · table · task-list · task-item
subscript · superscript · character-count
```

### Backend

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | **Node.js** | JavaScript server runtime |
| HTTP server | **Express** | REST API routing |
| WebSocket | **ws** | Raw WebSocket server for Yjs sync protocol |
| CRDT engine | **Yjs + y-protocols** | Server-side document state management |
| Auth | **jsonwebtoken + bcryptjs** | JWT issuing and password hashing |
| Database ORM | **node-postgres (pg)** | PostgreSQL client |
| Cache / Pub-Sub | **redis** | Multi-server update propagation via pub/sub |
| Encoding | **lib0** | Binary encoding/decoding for Yjs protocol |

### Data Layer

| Store | Technology | What lives here |
|---|---|---|
| Primary DB | **PostgreSQL 16** | Users, documents, collaborators, comments, versions |
| Cache & Pub/Sub | **Redis 7** | Active session sync, cross-server CRDT update broadcast |
| In-memory | Node.js `Map` | Hot Y.Doc instances while a document is open |

### Infrastructure

| Concern | Tool |
|---|---|
| Containerization | **Docker + Docker Compose** |
| Package management | **npm** |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Browser (Next.js)                        │
│                                                              │
│   Tiptap Editor ←──── Yjs Y.Doc ←──── y-websocket client   │
│        │                                      │              │
│   Toolbar / Menus                      WebSocket (wss)       │
│   Comments sidebar                            │              │
│   Auth context (JWT)                   REST API (axios)      │
└──────────────────────┬────────────────────────┬─────────────┘
                       │ WebSocket              │ HTTPS
┌──────────────────────▼────────────────────────▼─────────────┐
│                    Node.js Server (Express + ws)             │
│                                                              │
│  HTTP upgrade → ws server                                    │
│      │                                                       │
│  JWT auth on WS handshake                                    │
│      │                                                       │
│  Yjs sync protocol handler (collab.js)                       │
│      ├── In-memory Y.Doc per document                        │
│      ├── Broadcast updates to all peers on this server       │
│      ├── Redis PUBLISH → other server instances              │
│      └── Debounced persist to PostgreSQL (3 s)              │
│                                                              │
│  REST routes: /api/auth  /api/documents  /api/comments       │
└──────┬────────────────────────────────────────┬─────────────┘
       │                                        │
┌──────▼──────┐                        ┌───────▼──────┐
│ PostgreSQL  │                        │    Redis     │
│             │                        │              │
│ users       │                        │ pub/sub      │
│ documents   │                        │ ydoc:* chan  │
│ comments    │                        └──────────────┘
│ versions    │
└─────────────┘
```

### Real-time Collaboration (CRDT)

Yjs uses **CRDT** (Conflict-free Replicated Data Types) to guarantee that concurrent edits always converge to the same document state — without locking, without a central sequencer, without conflicts.

```
User A types "Hello"              User B types "World"
       │                                  │
  Yjs local update                  Yjs local update
       │                                  │
  WebSocket → Node.js server ← WebSocket
                    │
           Yjs merges both updates
           (CRDT guarantees no conflicts)
                    │
       Broadcasts merged state to both clients
                    │
       Both clients converge to "Hello World" ✓
```

For multi-server deployments, every applied update is published to a `ydoc:<docId>` Redis channel. Other server instances subscribe and forward updates to their own connected clients.

---

## Database Schema

```sql
users                    -- id, email, password_hash, name, avatar_color
documents                -- id, title, owner_id, content, ydoc_state (BYTEA), is_public
document_collaborators   -- document_id, user_id, permission
comments                 -- id, document_id, user_id, content, selection_text, resolved, parent_id
document_versions        -- id, document_id, created_by, title, content, ydoc_state
```

---

## Project Structure

```
.
├── docker-compose.yml           PostgreSQL + Redis services
├── backend/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── index.js             Express server + WebSocket upgrade handler
│       ├── db/
│       │   ├── index.js         PostgreSQL connection pool
│       │   └── schema.sql       All table definitions
│       ├── middleware/
│       │   └── auth.js          JWT authentication middleware
│       ├── routes/
│       │   ├── auth.js          POST /register, /login, GET /me
│       │   ├── documents.js     CRUD + collaborators + versions
│       │   └── comments.js      Threaded comments
│       └── services/
│           └── collab.js        Yjs CRDT engine + Redis pub/sub
└── frontend/
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.js
    └── src/
        ├── app/
        │   ├── page.tsx             Login / Register
        │   ├── dashboard/page.tsx   Document list
        │   └── doc/[id]/page.tsx    Editor page
        ├── components/
        │   ├── Editor/
        │   │   ├── Editor.tsx       Tiptap + Yjs + WebSocket setup
        │   │   └── Toolbar.tsx      Full formatting toolbar
        │   ├── Header/
        │   │   └── DocHeader.tsx    Title, menu bar, share modal
        │   └── Sidebar/
        │       └── CommentsSidebar.tsx
        ├── contexts/
        │   └── AuthContext.tsx      JWT auth state
        └── lib/
            └── api.ts              Axios client with auth interceptor
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose

### 1. Start infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL (port 5432) and Redis (port 6379).

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env and set a strong JWT_SECRET
npm install
npm run dev
```

The server runs on **http://localhost:3001**.  
The PostgreSQL schema is applied automatically on startup.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP + WebSocket server port |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/gdocs` | PostgreSQL connection string |
| `JWT_SECRET` | — | Secret for signing JWTs (change in production) |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `FRONTEND_URL` | `http://localhost:3000` | CORS allowed origin |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api` | Backend REST API base URL |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:3001` | Backend WebSocket URL |

---

## API Reference

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Sign in, returns JWT |
| `GET` | `/api/auth/me` | Get current user |

### Documents

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/documents` | List owned + shared documents |
| `POST` | `/api/documents` | Create document |
| `GET` | `/api/documents/:id` | Get document + collaborators |
| `PATCH` | `/api/documents/:id` | Update title / visibility |
| `DELETE` | `/api/documents/:id` | Delete document |
| `POST` | `/api/documents/:id/collaborators` | Add collaborator by email |
| `POST` | `/api/documents/:id/versions` | Save named version |
| `GET` | `/api/documents/:id/versions` | List versions |

### Comments

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/documents/:id/comments` | List threaded comments |
| `POST` | `/api/documents/:id/comments` | Add comment or reply |
| `PATCH` | `/api/documents/:id/comments/:cid` | Edit / resolve comment |
| `DELETE` | `/api/documents/:id/comments/:cid` | Delete comment |

### WebSocket

```
ws://localhost:3001/collab/:documentId?token=<JWT>
```

Implements the Yjs sync protocol (message types 0 = sync, 1 = awareness). The token is validated on the HTTP upgrade handshake before the WebSocket is established.

---

## Scaling

The backend is designed to scale horizontally:

- Each server instance holds in-memory Y.Doc objects only for documents with active connections
- On every document update, the server publishes a binary diff to the Redis channel `ydoc:<docId>`
- All other instances subscribed to that channel apply the diff and forward it to their local clients
- PostgreSQL stores the authoritative CRDT snapshot (persisted every 3 seconds via debounce)

---

## License

MIT
