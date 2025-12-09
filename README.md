# Collaborative Text Editor (CTE) – DPCS Project

A full-stack collaborative text editor for the DPCS course. Users can register/login, create and share documents, and edit together in real time. Edits are persisted in PostgreSQL via Prisma; collaboration runs over Socket.IO with basic OT, presence, live cursors, version history, and comments/notes.

## Tech Stack
- **Backend:** Node.js, TypeScript, Express, Prisma, Socket.IO, JWT
- **Database:** PostgreSQL (Docker)
- **Frontend:** React, TypeScript, Vite, React Router, Socket.IO client

## Key Features
- Auth: register/login/me with JWT.
- Documents & permissions: create/read/update/delete, share by email (VIEW/COMMENT/EDIT), duplicate/rename/delete.
- Realtime: OT-applied ops, presence, live cursors/selections, autosave indicator, per-user undo/redo.
- Version history: list snapshots per document.
- Comments/notes: add/list/delete comments on a document (in-memory store).
- Dev seed: Marty/Doc users and a shared “Time Travel Test Doc.”

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
  docker-compose.yml # PostgreSQL service
```

## Prerequisites
- Node.js 18+
- npm
- Docker (for Postgres)

## Setup & Run (local)
1) Start Postgres  
```bash
docker compose up -d postgres
```
2) Backend  
```bash
cd server
npm install
# server/.env must include:
# DATABASE_URL="postgresql://cte_user:cte_password@localhost:5432/cte_db?schema=public"
# JWT_SECRET="change-me"
npx prisma migrate dev --name init
npm run seed:dev   # seeds Marty/Doc + Time Travel Test Doc
npm run dev        # API + Socket.IO on :4000
```
3) Frontend  
```bash
cd client
npm install
npm run dev        # Vite on :5173
```

## API Overview (high level)
- **Auth:** `POST /auth/register`, `POST /auth/login`, `GET /auth/me` (Bearer JWT).
- **Documents:** list/create (`GET/POST /documents`); get/update/delete (`/documents/:id`); share (`POST /documents/:id/share`); duplicate (`POST /documents/:id/duplicate`); permissions (`GET/POST /documents/:id/permissions`); versions (`GET /documents/:id/versions`).
- **Comments (in-memory):** `GET /documents/:id/comments`, `POST /documents/:id/comments`, `DELETE /documents/:id/comments/:commentId`.
- **Realtime (Socket.IO):** `join_document`, `leave_document`, `cursor_update` (cursor/selection), `op` → `op_applied`, `presence` (join/leave).

## Troubleshooting
- Port 4000 in use: stop other listeners or set `PORT` before `npm run dev`.
- Failed to fetch / CORS: ensure backend on :4000, frontend on :5173, CORS enabled; JWT stored; correct base URL.
- DB/migrations: Postgres must be running (`docker compose up -d postgres`); rerun `npx prisma migrate dev`.
- Seed data missing: run `npm run seed:dev` in `server/`.
- Realtime not syncing: confirm Socket.IO connects with auth token and both tabs joined the same document; check backend logs for auth errors.
