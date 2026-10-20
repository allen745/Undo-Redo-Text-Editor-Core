/* =====================================================================
   FRONTEND CLIENT
   This file holds NO data structures and NO undo/redo logic.
   Every edit is sent to the backend; every redraw uses the state the
   backend sends back. This is the "dumb client, smart server" pattern.
   ===================================================================== */

const API = "https://undo-redo-text-editor-core.onrender.com/api";
let sessionId = localStorage.getItem("editorSessionId") || null;
let state = null;          // last state received from backend
let hitRanges = [];        // highlight ranges from the last /find call

const $ = (id) => document.getElementById(id);
const sheet = $("sheet");

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ---------- networking ---------- */
async function api(path, body) {
  const headers = { "Content-Type": "application/json" };
  if (sessionId) headers["x-session-id"] = sessionId;
  const res = await fetch(API + path, {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error("Request failed: " + path);
  const data = await res.json();
  if (data.sessionId) {
    sessionId = data.sessionId;
    localStorage.setItem("editorSessionId", sessionId);
  }
  return data;
}

async function connect() {
  try {
    const data = await api("/session");
    state = data.state;
    $("connStatus").textContent = "Connected to backend (session " + sessionId.slice(0, 8) + "…)";
    $("connStatus").className = "ok";
    renderAll();
  } catch (e) {
    $("connStatus").textContent = "Cannot reach backend at " + API + " — is the server running?";
    $("connStatus").className = "err";
  }
}

/* ---------- rendering (pure function of `state`) ---------- */
function renderSheet() {
  const text = state.text, ci = state.cursor;
  let out = "";
  if (!text.length) out += '<span class="hint">Click here and start typing...</span>';
  for (let i = 0; i <= text.length; i++) {
    if (i === ci) out += '<span class="caret"></span>';
    if (i < text.length) {
      let inHit = false;
      for (const h of hitRanges) if (i >= h[0] && i < h[1]) inHit = true;
      const c = esc(text[i]);
      out += inHit ? '<span class="hit">' + c + "</span>" : c;
    }
  }
  sheet.innerHTML = out;
}

function renderChain() {
  const text = state.text, MAX = 18, ci = state.cursor, total = text.length;
  let html = '<div class="term">HEAD</div>';
  let from = 0, to = total;
  if (total > MAX) { from = Math.max(0, Math.min(ci - Math.floor(MAX / 2), total - MAX)); to = from + MAX; }
  if (from > 0) html += '<div class="link"></div><div class="term">… ' + from + "</div>";
  for (let i = from; i < to; i++) {
    const isCur = i === ci;
    const c = text[i] === " " ? "␣" : text[i] === "\n" ? "↵" : text[i];
    html += '<div class="link"></div><div class="node' + (isCur ? " cursor" : "") + '">' + esc(c) + "<small>" + i + "</small></div>";
  }
  if (ci === total) html = html.replace(/cursor/, "cursor"); // cursor can be at very end, handled below
  if (to < total) html += '<div class="link"></div><div class="term">… ' + (total - to) + "</div>";
  html += '<div class="link"></div><div class="term">TAIL</div>';
  $("chain").innerHTML = html;
  const cur = $("chain").querySelector(".cursor");
  if (cur) cur.scrollIntoView({ block: "nearest", inline: "nearest" });
  $("listMeta").textContent = total + " nodes · cursor at " + ci + " (server-side)";
}

function renderStack(list, el, countEl) {
  let html = "";
  list.forEach((c, i) => {
    html += '<div class="plate' + (i === 0 ? " top" : "") + '"><span class="k">' + esc(c.label) + '</span><span class="p">@' + c.pos + "</span></div>";
  });
  el.innerHTML = html || '<div class="empty">empty</div>';
  countEl.textContent = list.length;
}

function renderWords() {
  const es = state.words;
  let html = "";
  for (const e of es) html += "<li><span>" + esc(e.key) + "</span><b>" + e.count + "</b></li>";
  $("wlist").innerHTML = html || '<li><span style="color:#6b747d">no words yet</span></li>';
  const totalWords = es.reduce((t, e) => t + e.count, 0);
  $("stats").innerHTML =
    "<span>Top words <b>" + totalWords + "</b></span><span>Unique <b>" + state.uniqueWords + "</b></span><span>Buckets <b>" + state.bucketCount + "</b></span>";
}

function renderAll() {
  renderSheet(); renderChain();
  renderStack(state.undo, $("uPlates"), $("uCount"));
  renderStack(state.redo, $("rPlates"), $("rCount"));
  renderWords();
  $("btnUndo").disabled = state.undo.length === 0;
  $("btnUndoN").disabled = state.undo.length === 0;
  $("btnRedo").disabled = state.redo.length === 0;
  $("btnRedoN").disabled = state.redo.length === 0;
}

function clearHits() { hitRanges = []; $("findStatus").textContent = ""; }
function setStatus(msg) { $("status").innerHTML = msg; }

/* ---------- input: every keystroke is an API call ---------- */
sheet.addEventListener("keydown", async (e) => {
  const k = e.key, mod = e.ctrlKey || e.metaKey;
  try {
    if (mod && (k === "z" || k === "Z") && !e.shiftKey) { e.preventDefault(); await doUndo(1); return; }
    if (mod && (k === "y" || k === "Y" || ((k === "z" || k === "Z") && e.shiftKey))) { e.preventDefault(); await doRedo(1); return; }
    if (mod) return;
    let handled = true;
    if (k.length === 1) { state = (await api("/type", { char: k })).state; }
    else if (k === "Enter") { state = (await api("/type", { char: "\n" })).state; }
    else if (k === "Backspace") { state = (await api("/backspace")).state; }
    else if (k === "Delete") { state = (await api("/delete")).state; }
    else if (k === "ArrowLeft") { state = (await api("/move", { direction: "left" })).state; }
    else if (k === "ArrowRight") { state = (await api("/move", { direction: "right" })).state; }
    else if (k === "Home") { state = (await api("/move", { direction: "home" })).state; }
    else if (k === "End") { state = (await api("/move", { direction: "end" })).state; }
    else handled = false;
    if (handled) { e.preventDefault(); clearHits(); renderAll(); }
  } catch (err) { setStatus('<span style="color:#d1495b">Lost connection to backend.</span>'); }
});

async function doUndo(steps) {
  const data = await api("/undo", { steps });
  state = data.state; clearHits(); renderAll();
  return data.stepsDone;
}
async function doRedo(steps) {
  const data = await api("/redo", { steps });
  state = data.state; clearHits(); renderAll();
  return data.stepsDone;
}

$("btnUndo").onclick = async () => { await doUndo(1); sheet.focus(); };
$("btnRedo").onclick = async () => { await doRedo(1); sheet.focus(); };
$("btnUndoN").onclick = async () => {
  const n = Math.max(1, parseInt($("nSteps").value) || 1);
  const done = await doUndo(n);
  setStatus("Undid <b>" + done + "</b> steps (processed on backend)."); sheet.focus();
};
$("btnRedoN").onclick = async () => {
  const n = Math.max(1, parseInt($("nSteps").value) || 1);
  const done = await doRedo(n);
  setStatus("Redid <b>" + done + "</b> steps (processed on backend)."); sheet.focus();
};
$("btnClear").onclick = async () => {
  state = (await api("/reset", {})).state; clearHits(); setStatus(""); renderAll(); sheet.focus();
};

/* ---------- find / replace ---------- */
$("btnFind").onclick = async () => {
  const p = $("findIn").value;
  const data = await api("/find", { pattern: p });
  state = data.state;
  hitRanges = data.hits.map((h) => [h, h + data.patternLength]);
  $("findStatus").innerHTML = p ? "Found <b>" + data.hits.length + "</b> match" + (data.hits.length === 1 ? "" : "es") + " (server-side linear search)." : "Type something to find.";
  renderSheet();
};
$("btnReplace").onclick = async () => {
  const p = $("findIn").value, r = $("repIn").value;
  if (!p) { $("findStatus").textContent = "Type something to find."; return; }
  const data = await api("/replace", { pattern: p, replacement: r });
  state = data.state; hitRanges = [];
  $("findStatus").innerHTML = data.replacedCount ? "Replaced <b>" + data.replacedCount + "</b>. Press Undo to bring it back." : "No matches.";
  renderAll();
};
$("findIn").addEventListener("keydown", (e) => { if (e.key === "Enter") $("btnFind").click(); });

/* ---------- spell suggestions on word boundary ---------- */
sheet.addEventListener("keyup", async (e) => {
  if (!state) return;
  const text = state.text, ci = state.cursor;
  let s = ci;
  while (s > 0 && /[a-zA-Z']/.test(text[s - 1])) s--;
  const cw = text.slice(s, ci).toLowerCase();
  if (cw.length < 3) { $("sugg").innerHTML = ""; return; }
  const data = await api("/suggest", { word: cw });
  if (!data.suggestions.length) { $("sugg").innerHTML = ""; return; }
  let html = "Did you mean: ";
  for (const sgg of data.suggestions) html += '<span class="chip" data-w="' + esc(sgg.word) + '" data-s="' + s + '" data-e="' + ci + '">' + esc(sgg.word) + "</span>";
  $("sugg").innerHTML = html;
});

$("sugg").addEventListener("click", async (e) => {
  const t = e.target.closest(".chip"); if (!t) return;
  const s = +t.dataset.s, en = +t.dataset.e, w = t.dataset.w;
  const data = await api("/replace", { pattern: state.text.slice(s, en), replacement: w });
  // replaceAll could match elsewhere too; for a project demo this is an acceptable simplification
  state = data.state; renderAll(); sheet.focus();
});

/* ---------- demo: type, undo 10, redo 5 ---------- */
let demoBusy = false;
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
$("btnDemo").onclick = async () => {
  if (demoBusy) return; demoBusy = true; $("btnDemo").disabled = true;
  try {
    setStatus("Resetting and typing on the backend...");
    const data = await api("/demo-type", {});
    state = data.state; clearHits(); renderAll();
    await sleep(500);
    setStatus("Undoing <b>10</b> steps via the server. Watch plates move.");
    for (let i = 0; i < 10; i++) { await doUndo(1); await sleep(220); }
    await sleep(500);
    setStatus("Redoing <b>5</b> steps via the server.");
    for (let i = 0; i < 5; i++) { await doRedo(1); await sleep(300); }
    await sleep(500);
    setStatus("Typing a new letter: the redo stack clears, because the old future no longer applies.");
    await sleep(1200);
    const r = await api("/type", { char: "!" });
    state = r.state; renderAll();
    setStatus("Redo stack cleared. Demo finished.");
  } finally {
    demoBusy = false; $("btnDemo").disabled = false; sheet.focus();
  }
};

sheet.addEventListener("focus", renderSheet);
connect();
