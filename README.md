# Synq — Backend

Node.js + Express REST API and Socket.IO server for **Synq**, a real-time
collaborative code editor. Handles auth, projects, files, version history,
AI-powered coding assistance (Hugging Face), code execution (Piston), and a
two-tier social layer (connections + project invites).

## Tech Stack

- **Runtime:** Node.js + Express 4
- **Database:** MongoDB + Mongoose 8
- **Realtime:** Socket.IO 4 (JWT-authenticated, room-based broadcast)
- **Auth:** jsonwebtoken (access + refresh pair) + bcryptjs
- **AI:** `@huggingface/inference` (Qwen2.5-Coder models)
- **Code execution:** Piston public API via axios
- **Security/infra:** cors, cookie-parser, express-rate-limit, morgan

## Setup

```bash
npm install
cp .env.example .env   # fill in your own values
npm run dev             # nodemon, http://localhost:5000
# or
npm start                # plain node
```

## Environment Variables (`.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | no (default `5000`) | port the server listens on |
| `MONGO_URI` | **yes** | MongoDB connection string (Atlas or local) |
| `JWT_ACCESS_SECRET` | **yes** | signing secret for short-lived access tokens |
| `JWT_REFRESH_SECRET` | **yes** | signing secret for refresh tokens |
| `JWT_ACCESS_EXPIRES` | no (default `15m`) | access token lifetime |
| `JWT_REFRESH_EXPIRES` | no (default `7d`) | refresh token lifetime |
| `CLIENT_URL` | **yes** | frontend origin, used for CORS + cookie policy (e.g. `http://localhost:5173`) |
| `HF_TOKEN` | **yes** | Hugging Face API token, used by all `/api/ai/*` routes |
| `HF_MODEL_MAIN` | no (default `Qwen/Qwen2.5-Coder-32B-Instruct`) | model for explain/refactor/docs/tests/chat |
| `HF_MODEL_FAST` | no (default `Qwen/Qwen2.5-Coder-7B-Instruct`) | model for low-latency inline completion |
| `PISTON_API_URL` | **yes** | Piston execution API endpoint used by `/api/execution/run` |

> Never commit `.env`. Generate strong random values for both JWT secrets
> (e.g. `openssl rand -hex 64`).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | starts with nodemon (auto-restart on file change) |
| `npm start` | starts with plain `node server.js` |

## Project Structure

```
Synq-backend/
├── server.js                  entry point — Express app + Socket.IO
├── config/db.js                mongoose connection
├── middleware/
│   ├── auth.js                 verifyToken — JWT bearer check
│   ├── projectAccess.js        checkProjectAccess(minRole) — RBAC
│   └── errorHandler.js         notFound + centralized error handler
├── models/                     User, Project, File, Version,
│                                 Connection, ProjectInvite, ChatMessage
├── controllers/                one per resource (auth, project, file,
│                                 version, ai, execution, user, connection,
│                                 projectInvite)
├── routes/                     thin route wiring per resource
├── services/pistonService.js   axios wrapper around Piston
└── utils/
    ├── generateTokens.js       signs access/refresh JWTs
    └── languageMap.js          language → Piston {language, version}
```

## API Overview

All protected routes expect `Authorization: Bearer <accessToken>`.
Full endpoint-by-endpoint reference is in `Synq_Documentation.docx`.

| Base path | Purpose |
|---|---|
| `/api/auth` | register, login, refresh, logout, me |
| `/api/projects` | create/list/get/update/delete, collaborators, invites |
| `/api/files` | file tree, CRUD, content save (with optional version snapshot) |
| `/api/versions` | list & restore version snapshots |
| `/api/ai` | complete, detect-bugs, explain, refactor, docs, tests, chat (SSE) |
| `/api/execution` | run code via Piston |
| `/api/users` | search, public profile, edit own profile |
| `/api/connections` | send/accept/reject/remove connection requests |
| `/api/invites` | list/accept/reject project collaboration invites |
| `/api/health` | health check |

## Real-Time Events (Socket.IO)

Socket auth: JWT sent as `socket.handshake.auth.token`.

| Event | Direction | Payload |
|---|---|---|
| `file:join` | client → server | `{ projectId, fileId }` |
| `file:leave` | client → server | `{ fileId }` |
| `code:change` | client → server | `{ fileId, content }` |
| `presence:update` | server → room | `{ fileId, users }` |
| `code:update` | server → room | `{ fileId, content, userId, name }` |

Collaboration model is **broadcast-based last-write-wins** — no CRDT/OT.

## Deployment

Production runs on **AWS EC2**, behind **Nginx** as a reverse proxy, managed
by **PM2** for process supervision, auto-restart, and log management.