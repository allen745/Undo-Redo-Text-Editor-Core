# Undo/Redo Text Editor Core — Frontend + Backend

A client-server version of the editor engine. The backend owns every data
structure (doubly linked list, two stacks, hash table). The frontend only
sends keystrokes over HTTP and redraws whatever state the backend returns —
it holds no document and no undo history of its own.

```
editor-app/
├── backend/
│   ├── engine.js        <- the DSA: Document, Stack, HashTable, Editor
│   ├── server.js         <- Express REST API over engine.js
│   ├── test-engine.js    <- 17 automated tests for the engine
│   └── package.json
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── app.js             <- talks to the backend only via fetch()
│   └── serve.js           <- tiny static file server (no framework needed)
└── README.md
```

## How to run

**1. Start the backend** (in one terminal):
```bash
cd backend
npm install
npm start
```
You should see: `Editor backend running on http://localhost:4000`

**2. Start the frontend** (in a second terminal):
```bash
cd frontend
node serve.js
```
You should see: `Frontend running on http://localhost:5500`

**3. Open your browser** at `http://localhost:5500`

Click the editor sheet and start typing. The right-hand panel shows the
linked list, the undo stack, the redo stack, and the word-frequency table —
all computed on the backend and sent down as JSON.

## Running the engine tests
```bash
cd backend
npm test
```
This runs 17 checks covering insert/delete, undo/redo, stack sizes, redo
clearing after a new edit, find/replace (including replace-all being
undoable), the hash table, spell suggestions, and linked-list integrity.

## How the split works (for your report / viva)

| Layer | File | Responsibility |
|---|---|---|
| Backend — DSA | `engine.js` | `Document` (doubly linked list), `Stack` (for undo/redo), `HashTable` (word frequency), `Editor` (wires them together), `suggestions()` (spell check) |
| Backend — API | `server.js` | Turns HTTP requests into calls on an `Editor` instance. One `Editor` per browser tab, kept in a `Map` keyed by session id |
| Frontend | `app.js` | Sends every keystroke as a `fetch()` call, then re-renders the page from the JSON state the backend returns |

### Why split it this way
- **Matches the brief's team split.** Person A's linked-list/cursor code and
  Person B's stack/search/hash code both live in `engine.js`, clearly
  separable by class. The frontend is a separate concern either person (or
  both together) can build.
- **Shows a real client-server architecture**, which is closer to how
  production editors like Google Docs actually work (the server holds the
  source of truth).
- **The frontend cannot cheat.** Because it has no data structures of its
  own, every undo/redo/find/replace you see in the browser is proof the
  backend logic actually ran.

### API reference

| Method | Path | Body | What it does |
|---|---|---|---|
| GET | `/api/session` | — | Create or fetch the current session's state |
| POST | `/api/type` | `{ char }` | Insert one character at the cursor |
| POST | `/api/backspace` | — | Delete the character before the cursor |
| POST | `/api/delete` | — | Delete the character after the cursor |
| POST | `/api/move` | `{ direction }` | `left` \| `right` \| `home` \| `end` |
| POST | `/api/undo` | `{ steps }` | Undo N steps |
| POST | `/api/redo` | `{ steps }` | Redo N steps |
| POST | `/api/find` | `{ pattern }` | Linear search, returns match positions |
| POST | `/api/replace` | `{ pattern, replacement }` | Undoable replace-all |
| POST | `/api/suggest` | `{ word }` | Spell suggestions from the hash table |
| POST | `/api/reset` | — | Clear the document and all history |
| POST | `/api/demo-type` | — | Reset and type the demo sentence |

Every response includes `state`, the same JSON shape `renderAll()` on the
frontend uses to redraw the page.

## Notes
- State lives in server memory only (a `Map` of sessions) — restarting the
  backend clears all documents. Said plainly in a viva: "we chose in-memory
  storage because the brief doesn't require persistence; the engine design
  makes adding a database later straightforward."
- CORS is enabled on the backend so the frontend (a different port) can
  call it directly — this is the standard setup for separate frontend/backend
  processes during development.
