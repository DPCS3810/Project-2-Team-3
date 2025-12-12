# Collaborative Text Editor (CTE) 

A full-stack collaborative text editor. Users can register/login, create and share documents, and edit together in real time. Edits are persisted in PostgreSQL via Prisma; collaboration runs over Socket.IO with basic OT, presence, live cursors, version history, and comments/notes.

## Tech Stack
* **Backend**: Node.js, TypeScript, Express, Prisma, Socket.IO, JWT
* **Database**: PostgreSQL (Docker for local, Render PostgreSQL for production)
* **Frontend**: React, TypeScript, Vite, React Router, Socket.IO client
* **Deployment**: Render.com (Web Service + Static Site + PostgreSQL)

## Key Features
* **Auth**: register/login/me with JWT.
* **Documents & permissions**: create/read/update/delete, share by email (VIEW/COMMENT/EDIT), duplicate/rename/delete.
* **Realtime**: OT-applied ops, presence, live cursors/selections, autosave indicator, per-user undo/redo.
* **Version history**: list snapshots per document.
* **Comments/notes**: add/list/delete comments on a document (in-memory store).
* **Dev seed**: Marty/Doc users and a shared "Time Travel Test Doc."

## Project Structure

```
cte-project/
  server/            # Express + Prisma + Socket.IO
    src/
      app.ts, index.ts
      modules/       # auth, documents, collab, comments
      db/prisma.ts
      dev/           # seed scripts
    prisma/          # schema + migrations
  client/            # React + Vite frontend
    src/             # auth pages, documents pages, CollaborativeEditor, components
  docker-compose.yml # PostgreSQL service (local development)
```

---

## Live Deployment

**Access the live application:**
- **Frontend**: https://cte-frontend.onrender.com
- **Backend API**: https://cte-backend.onrender.com
- **Repository**: https://github.com/DPCS3810/Project-2-Team-3

### Deployment Architecture

```
┌─────────────────────────────────────────┐
│  Frontend (Render Static Site)          │
│  https://cte-frontend.onrender.com      │
│  - React + Vite + TypeScript            │
└─────────────────┬───────────────────────┘
                  │ HTTP/WebSocket
┌─────────────────▼───────────────────────┐
│  Backend (Render Web Service)           │
│  https://cte-backend.onrender.com       │
│  - Node.js + Express + Socket.IO        │
└─────────────────┬───────────────────────┘
                  │ Prisma ORM
┌─────────────────▼───────────────────────┐
│  PostgreSQL Database                    │
│  (Render PostgreSQL)                    │
└─────────────────────────────────────────┘
```

---

## Prerequisites
* Node.js 18+
* npm
* Docker (for local Postgres)

## Setup & Run (Local Development)

### 1. Start Postgres

```bash
docker compose up -d postgres
```

### 2. Backend

```bash
cd server
npm install
# server/.env must include:
# DATABASE_URL="postgresql://cte_user:cte_password@localhost:5432/cte_db?schema=public"
# JWT_SECRET="change-me"
# CORS_ORIGIN="http://localhost:5173"
npx prisma migrate dev --name init
npm run seed:dev   # seeds Marty/Doc + Time Travel Test Doc
npm run dev        # API + Socket.IO on :4000
```

### 3. Frontend

```bash
cd client
npm install
# client/.env.local should include:
# VITE_API_URL=http://localhost:4000
# VITE_WS_URL=http://localhost:4000
npm run dev        # Vite on :5173
```

---

## API Overview (High Level)

* **Auth**: `POST /auth/register`, `POST /auth/login`, `GET /auth/me` (Bearer JWT)
* **Documents**: 
  - List/Create: `GET/POST /documents`
  - Get/Update/Delete: `GET/PUT/DELETE /documents/:id`
  - Share: `POST /documents/:id/share`
  - Duplicate: `POST /documents/:id/duplicate`
  - Permissions: `GET/POST /documents/:id/permissions`
  - Versions: `GET /documents/:id/versions`
* **Comments (in-memory)**: 
  - List: `GET /documents/:id/comments`
  - Create: `POST /documents/:id/comments`
  - Delete: `DELETE /documents/:id/comments/:commentId`
* **Realtime (Socket.IO)**: 
  - Events: `join_document`, `leave_document`, `cursor_update`, `op` → `op_applied`, `presence`

---

## Testing Real-Time Collaboration

### Local:
1. Open http://localhost:5173 in two browser windows
2. Register/login with different accounts in each window
3. Create a document in one window and share with the other user
4. Open the same document in both windows
5. Type in one window and verify changes appear instantly in the other

### Production:
1. Open https://cte-frontend.onrender.com in two browser windows
2. Follow the same steps as local testing
3. Verify real-time synchronization between windows

---

## Troubleshooting

### Local Development:
* **Port 4000 in use**: Stop other listeners or set `PORT` environment variable
* **Failed to fetch / CORS**: Ensure backend on :4000, frontend on :5173, CORS enabled; JWT stored; correct base URL
* **DB/migrations**: Postgres must be running (`docker compose up -d postgres`); rerun `npx prisma migrate dev`
* **Seed data missing**: Run `npm run seed:dev` in `server/`
* **Realtime not syncing**: Confirm Socket.IO connects with auth token and both tabs joined the same document

### Production:
* Check Render dashboard for deployment status and logs
* Verify environment variables are configured correctly
* Ensure both frontend and backend services are running
