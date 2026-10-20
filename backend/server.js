/* =====================================================================
   SERVER — thin HTTP layer over engine.js.
   This file knows nothing about linked lists or stacks; it only:
     1. keeps one Editor instance per session id
     2. turns HTTP requests into calls on that Editor
     3. sends back JSON state for the frontend to render
   ===================================================================== */
const express = require("express");
const cors = require("cors");
const { randomUUID } = require("crypto");
const { Editor, suggestions } = require("./engine");

const app = express();
app.use(cors());
app.use(express.json());

// session store: sessionId -> Editor instance (one engine per browser tab)
const sessions = new Map();

function getEditor(req) {
  const id = req.headers["x-session-id"];
  if (id && sessions.has(id)) return { editor: sessions.get(id), id };
  const newId = randomUUID();
  const editor = new Editor();
  sessions.set(newId, editor);
  return { editor, id: newId };
}

function respond(res, editor, id, extra = {}) {
  res.json({ sessionId: id, state: editor.getState(), ...extra });
}

// ---------- create / fetch current state ----------
app.get("/api/session", (req, res) => {
  const { editor, id } = getEditor(req);
  respond(res, editor, id);
});

// ---------- typing ----------
app.post("/api/type", (req, res) => {
  const { editor, id } = getEditor(req);
  const { char } = req.body;
  if (typeof char !== "string" || char.length !== 1) {
    return res.status(400).json({ error: "char must be a single character" });
  }
  editor.typeChar(char);
  respond(res, editor, id);
});

app.post("/api/backspace", (req, res) => {
  const { editor, id } = getEditor(req);
  editor.backspace();
  respond(res, editor, id);
});

app.post("/api/delete", (req, res) => {
  const { editor, id } = getEditor(req);
  editor.deleteForward();
  respond(res, editor, id);
});

// ---------- cursor ----------
app.post("/api/move", (req, res) => {
  const { editor, id } = getEditor(req);
  const { direction } = req.body; // "left" | "right" | "home" | "end"
  editor.moveCursor(direction);
  respond(res, editor, id);
});

// ---------- undo / redo ----------
app.post("/api/undo", (req, res) => {
  const { editor, id } = getEditor(req);
  const steps = Math.max(1, parseInt(req.body.steps) || 1);
  let done = 0;
  for (let i = 0; i < steps; i++) if (editor.undo()) done++;
  respond(res, editor, id, { stepsDone: done });
});

app.post("/api/redo", (req, res) => {
  const { editor, id } = getEditor(req);
  const steps = Math.max(1, parseInt(req.body.steps) || 1);
  let done = 0;
  for (let i = 0; i < steps; i++) if (editor.redo()) done++;
  respond(res, editor, id, { stepsDone: done });
});

// ---------- find / replace ----------
app.post("/api/find", (req, res) => {
  const { editor, id } = getEditor(req);
  const { pattern } = req.body;
  const hits = editor.findAll(pattern || "");
  respond(res, editor, id, { hits, patternLength: (pattern || "").length });
});

app.post("/api/replace", (req, res) => {
  const { editor, id } = getEditor(req);
  const { pattern, replacement } = req.body;
  const count = editor.replaceAll(pattern || "", replacement || "");
  respond(res, editor, id, { replacedCount: count });
});

// ---------- spell suggestions ----------
app.post("/api/suggest", (req, res) => {
  const { editor, id } = getEditor(req);
  const { word } = req.body;
  const list = word ? suggestions(word.toLowerCase(), editor.table) : [];
  respond(res, editor, id, { suggestions: list });
});

// ---------- reset ----------
app.post("/api/reset", (req, res) => {
  const { editor, id } = getEditor(req);
  editor.reset();
  respond(res, editor, id);
});

// ---------- demo: type a sentence (used by the "Run demo" button) ----------
app.post("/api/demo-type", (req, res) => {
  const { editor, id } = getEditor(req);
  editor.reset();
  const sentence = "the cat sat on the mat";
  for (const ch of sentence) editor.typeChar(ch);
  respond(res, editor, id);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Editor backend running on http://localhost:${PORT}`));

module.exports = app;
