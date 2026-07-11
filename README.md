# GenAI-Powered Collaborative Code Editor
### Complete Build Roadmap — MERN + GenAI

A web-based platform for writing, executing, and collaborating on code in real time — with a VS Code–like editor, project management, live collaboration, secure auth, version history, Git integration, and GenAI features (completion, bug detection, explanation, refactoring, docs, tests, RAG chatbot).

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENT (React)                          │
│  Monaco Editor | File Tree | Terminal UI | Chat Panel | Auth UI  │
└───────────────┬───────────────────────────────┬──────────────────┘
                │ REST / GraphQL                │ WebSocket (Socket.io)
┌───────────────▼───────────────┐   ┌────────────▼──────────────────┐
│      Express.js API Server     │   │   Real-Time Collab Server      │
│  Auth, Projects, Files, Git,   │   │  Yjs / CRDT sync, cursors,      │
│  Version History, AI routes    │   │  presence, live editing         │
└───────────────┬───────────────┘   └────────────┬──────────────────┘
                │                                 │
┌───────────────▼───────────────┐   ┌────────────▼──────────────────┐
│           MongoDB               │   │   Code Execution Service        │
│  Users, Projects, Files,        │   │  Docker sandboxes / Judge0 /    │
│  Versions, ChatHistory          │   │  isolated containers per lang   │
└─────────────────────────────────┘   └─────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────────┐
│                    GenAI Layer (separate service)                 │
│  LLM API (Claude/GPT) + Embeddings + Vector DB (RAG) +             │
│  Code completion / bug detection / refactor / docs / tests         │
└─────────────────────────────────────────────────────────────────┘
```

**Recommendation:** Keep AI logic in its own microservice (Node or Python/FastAPI) rather than cramming it into the main Express API. Cleaner scaling, easier to swap LLM providers later.

---

## 2. Core Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React + Vite, Redux Toolkit / Zustand, Tailwind CSS | Fast dev, you already know this stack |
| Code Editor | **Monaco Editor** (same engine as VS Code) | Syntax highlighting, IntelliSense, multi-language out of box |
| Real-time sync | **Yjs** (CRDT) + `y-websocket` or Socket.io | Conflict-free collaborative editing — do NOT hand-roll this |
| Backend API | Node.js + Express.js | MERN standard |
| Database | MongoDB + Mongoose | Document model fits projects/files well |
| Auth | JWT (access + refresh tokens) + bcrypt, optional Google OAuth | Secure, standard |
| File storage | MongoDB (small files) + optional S3/Cloudinary (large assets) | Cost-effective |
| Code execution | Docker containers per language, orchestrated via a queue, OR use **Judge0 API** (open source) to start | Building your own sandboxed executor from scratch is a big undertaking — Judge0 lets you ship faster |
| Git integration | `simple-git` (Node wrapper around Git CLI) or isomorphic-git (pure JS, browser-compatible) | isomorphic-git avoids needing Git installed server-side |
| Version history | Custom diffing (store snapshots/diffs in MongoDB) or piggyback on Git commits | Git-based is more robust, reuses Git's own history |
| GenAI / LLM | Claude API or OpenAI API | For completion, bug detection, explanation, refactor, docs, tests |
| Embeddings + RAG | OpenAI/Cohere embeddings + **Pinecone / Weaviate / Qdrant / pgvector** | For "chatbot understands entire codebase" |
| Deployment | Frontend: Vercel/Netlify. Backend: Render/Railway/AWS EC2. DB: MongoDB Atlas. Execution: separate container host | Keep execution service isolated from main API for security |

---

## 3. Feature Breakdown — What To Actually Build

### A. Core Platform (MERN side)

#### 1. Authentication & User Management
- Signup/login with email+password (bcrypt hashed) + JWT access/refresh token flow
- Optional: Google/GitHub OAuth (GitHub OAuth is useful later for Git integration anyway)
- Protected routes middleware (`verifyToken`)
- User profile: avatar, name, linked GitHub account

#### 2. Project Management
- Create/rename/delete projects (a "project" = a workspace with a file tree)
- Project schema: owner, collaborators (array of userId + role: owner/editor/viewer), language/template, createdAt
- File tree CRUD: create folder/file, rename, delete, move
- Nested folder structure — store as a tree in MongoDB (materialized path or parent-reference pattern works well)

#### 3. Code Editor (Monaco)
- Integrate `@monaco-editor/react`
- Syntax highlighting per language (auto-detect from file extension)
- Multi-tab editing (open files list)
- Theme support (dark/light — you already like a dark aesthetic, reuse that)
- Keyboard shortcuts (Ctrl+S save, Ctrl+/ comment, etc.)

#### 4. Live Collaboration (the hard part — plan extra time here)
- Use **Yjs** + `y-websocket` (or Yjs + Socket.io transport) for CRDT-based shared document state
- Show live cursors + user avatars/colors of collaborators currently editing
- Presence indicators (who's online in this project)
- Conflict-free merging — this is why you use a CRDT library instead of writing your own operational transform logic
- Optional: shared terminal session (harder — can be a stretch goal)

#### 5. Code Execution
- Start with **Judge0 API** (self-hosted or their cloud API) — supports 60+ languages, sandboxed
- Send code + stdin → get stdout/stderr/execution time back
- Show output in a terminal-style panel in the UI
- Later (stretch goal): your own Docker-based execution queue for more control

#### 6. Version History
- Two viable approaches:
  - **Simple:** save a snapshot/diff on every significant save, store in MongoDB (`versions` collection: fileId, content, diff, timestamp, authorId)
  - **Robust:** integrate actual Git under the hood — every save = a commit, use `isomorphic-git` to manage a real `.git` per project
- Show a version timeline UI, diff viewer (use a library like `react-diff-viewer`)
- Restore-to-previous-version action

#### 7. Git Integration
- Connect GitHub account via OAuth
- Clone a repo into a project, or push a project out to a new/existing GitHub repo
- Basic operations: commit, push, pull, branch switch — use `isomorphic-git` (works in Node, avoids shelling out to system git)
- Show commit history + diffs in UI

---

### B. GenAI Features

Design principle: **don't call the LLM directly from the browser.** Always route through your backend/AI microservice so you control API keys, rate-limit, and log usage.

#### 1. AI Code Completion
- Trigger on keystroke pause (debounce ~300-500ms) or on-demand (Ctrl+Space)
- Send: current file content (or a windowed context around cursor) + cursor position + file language
- Call LLM with a completion-style prompt: *"Complete the following code. Return only the code continuation."*
- Render as inline "ghost text" suggestion (Monaco supports inline completions via its API) — accept with Tab
- **Latency matters here** — consider a faster/smaller model for completion vs. a stronger model for chat/refactor

#### 2. Bug Detection
- On-demand action ("Analyze for bugs") or on-save background check
- Send full file (or diffed section) to LLM with a structured prompt asking for: line number, issue type, severity, suggested fix — ask the model to return **JSON** so you can render it as inline diagnostics (squiggly underlines in Monaco using `monaco.editor.setModelMarkers`)

#### 3. Code Explanation
- User selects a code block → right-click → "Explain this code"
- Send selected snippet + surrounding context → LLM returns plain-English explanation
- Show in a side panel or hover tooltip

#### 4. Refactoring
- User selects code → "Refactor" → optionally specify goal (e.g., "make this more readable", "convert to async/await")
- LLM returns refactored code → show a **diff preview** before applying (never auto-apply silently)

#### 5. Documentation Generation
- Select function/class → "Generate docs" → LLM returns JSDoc/docstring formatted comment block
- Insert above the selected code

#### 6. Unit Test Generation
- Select function → "Generate tests" → LLM returns test file content (detect testing framework from project, e.g., Jest for JS)
- Create/append to a `*.test.js` file

#### 7. RAG-Powered Codebase Chatbot (the most complex GenAI feature)
This is the centerpiece feature — plan the most time here.

**Indexing pipeline (runs when project is created/updated):**
1. Chunk each file (by function/class boundaries where possible, or fixed token windows with overlap)
2. Generate embeddings for each chunk (OpenAI `text-embedding-3-small` or similar)
3. Store embeddings + metadata (filePath, chunk text, line range) in a vector DB (Pinecone/Qdrant/pgvector — pgvector is free if you already have Postgres, otherwise Qdrant has a generous free tier)
4. Re-index incrementally on file save (don't re-embed the whole project every time — just changed files)

**Query pipeline (when user asks the chatbot something):**
1. Embed the user's question
2. Vector similarity search → retrieve top-K relevant chunks from the project
3. Construct a prompt: system instructions + retrieved chunks (with file path labels) + conversation history + user question
4. Call LLM, stream response back to UI
5. Cite which files the answer used (shows retrieved chunk sources)

**Chat UI:**
- Persistent chat panel per project
- Store chat history in MongoDB (`chatHistory` collection: projectId, userId, messages[])
- Streaming responses (Server-Sent Events or WebSocket) for a ChatGPT-like typing effect

---

## 4. Suggested MongoDB Schema (Starting Point)

```
User {
  _id, name, email, passwordHash, avatarUrl,
  githubAccessToken (encrypted), createdAt
}

Project {
  _id, name, ownerId, collaborators: [{ userId, role }],
  language, createdAt, updatedAt,
  gitRepoUrl (optional)
}

File {
  _id, projectId, path, name, type: "file"|"folder",
  parentId, content, language, updatedAt
}

Version {
  _id, fileId, projectId, content, diff,
  authorId, message, createdAt
}

ChatMessage {
  _id, projectId, userId, role: "user"|"assistant",
  content, sourceFiles: [filePath], createdAt
}

CodeEmbedding {   // if using pgvector; separate store if using Pinecone/Qdrant
  _id, projectId, filePath, chunkText, embedding: [float],
  startLine, endLine
}
```

---

## 5. Suggested API Route Groups

```
/api/auth          → register, login, refresh, logout, oauth/github
/api/projects       → CRUD projects, add/remove collaborator
/api/files           → CRUD files/folders, save content
/api/versions        → list versions, restore, diff
/api/git              → clone, commit, push, pull, branches
/api/execute          → run code (proxies to Judge0 or execution service)
/api/ai/complete       → code completion
/api/ai/detect-bugs     → bug detection
/api/ai/explain          → code explanation
/api/ai/refactor          → refactor suggestion
/api/ai/docs                → doc generation
/api/ai/tests                → test generation
/api/ai/chat (SSE/WS)          → RAG chatbot query + streaming response
```

Real-time (Socket.io / Yjs provider):
```
ws:// collaboration namespace → doc sync, cursor position, presence, chat typing indicators
```

---

## 6. Build Order (Suggested Phases)

**Phase 1 — Core MERN skeleton (Weeks 1-2)**
- Auth (signup/login/JWT)
- Project CRUD + file tree CRUD
- Monaco editor wired up, save/load file content
- Basic dark UI shell (you already have a design system from DevBridge — reuse the aesthetic)

**Phase 2 — Collaboration + Execution (Weeks 3-4)**
- Yjs + WebSocket real-time sync, live cursors, presence
- Code execution via Judge0 integration
- Version history (simple snapshot approach first)

**Phase 3 — Git Integration (Week 5)**
- GitHub OAuth
- isomorphic-git: clone/commit/push/pull
- Commit history UI

**Phase 4 — GenAI Features Part 1 (Weeks 6-7)**
- AI code completion (inline suggestions)
- Bug detection (inline diagnostics)
- Code explanation, refactor, doc generation, test generation — these share similar "select code → call LLM → show result" plumbing, build one generic pipeline and reuse it

**Phase 5 — RAG Chatbot (Weeks 8-9)**
- Chunking + embedding pipeline
- Vector DB integration
- Chat UI with streaming + source citations
- Incremental re-indexing on file changes

**Phase 6 — Polish + Deploy (Week 10)**
- Error handling, loading states, rate limiting on AI routes (this is where your API costs live — cap requests per user)
- Deploy: frontend (Vercel), backend (Render/Railway), MongoDB Atlas, vector DB (Qdrant Cloud free tier)
- Load test collaboration with multiple simultaneous users

---

## 7. Things That Will Bite You If You Don't Plan Early

- **Don't build your own OT/CRDT logic.** Use Yjs — collaborative editing is a genuinely hard distributed-systems problem and reinventing it will eat your whole timeline.
- **Sandbox code execution properly.** Never `eval()` or run arbitrary user code directly on your API server — always isolate (Docker/Judge0), or you've built a remote code execution vulnerability into your own product.
- **Rate-limit and cache AI calls.** LLM API costs add up fast with completion-on-every-keystroke — debounce aggressively and consider caching identical requests.
- **Encrypt stored GitHub tokens** (`crypto` module, not plaintext in MongoDB).
- **Chunk size for RAG matters a lot** — too small loses context, too large wastes tokens and dilutes relevance. Start around 200-400 tokens per chunk with ~20% overlap, tune from there.
- **Stream AI responses** wherever you can (SSE/WebSocket) — a spinner for 10 seconds on a chatbot feels broken; token-by-token streaming feels alive.

---

*Reference doc for: GenAI-Powered Collaborative Code Editor — MERN + GenAI build*
#   S y n q _ B a c k e n d  
 