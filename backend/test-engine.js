const { Editor, HashTable, wordsOf, suggestions } = require("./engine");

let ok = true;
function check(name, cond) {
  console.log((cond ? "PASS " : "FAIL ") + name);
  if (!cond) ok = false;
}

// ---- typing + undo/redo ----
const e = new Editor();
for (const c of "hello world") e.typeChar(c);
check("type", e.doc.text() === "hello world");

for (let i = 0; i < 5; i++) e.undo();
check("undo 5 -> 'hello '", e.doc.text() === "hello ");
check("stack sizes 6/5", e.undoStack.size === 6 && e.redoStack.size === 5);

for (let i = 0; i < 3; i++) e.redo();
check("redo 3 -> 'hello wor'", e.doc.text() === "hello wor");

e.typeChar("X");
check("new edit clears redo", e.redoStack.size === 0);

// ---- backspace in the middle, undo/redo ----
const f = new Editor();
for (const c of "abcde") f.typeChar(c);
f.doc.moveLeft(); f.doc.moveLeft();
f.backspace();
check("backspace middle", f.doc.text() === "abde");
f.undo();
check("undo backspace restores", f.doc.text() === "abcde");
f.redo();
check("redo backspace", f.doc.text() === "abde");

// ---- find / replace, fully undoable ----
const g = new Editor();
for (const c of "the cat sat on the mat") g.typeChar(c);
check("findAll", JSON.stringify(g.findAll("the")) === "[0,15]");
const n = g.replaceAll("the", "a");
check("replaceAll count", n === 2);
check("replaceAll text", g.doc.text() === "a cat sat on a mat");
let guard = 0;
while (g.undoStack.size > 0 && guard++ < 1000) g.undo();
check("undo all -> empty", g.doc.text() === "");
while (g.redoStack.size > 0 && guard++ < 2000) g.redo();
check("redo all -> replaced", g.doc.text() === "a cat sat on a mat");

// ---- hash table ----
const t = new HashTable(31);
["the", "cat", "the", "dog", "the"].forEach((w) => t.add(w));
check("hash count", t.find("the").count === 3 && t.n === 3);

// ---- spell suggestions ----
const w = new Editor();
for (const c of "hello hello world") w.typeChar(c);
const s = suggestions("helo", w.table);
check("suggest helo->hello", s.length > 0 && s[0].word === "hello");

// ---- delete forward ----
const d = new Editor();
for (const c of "abc") d.typeChar(c);
d.doc.moveHome();
d.deleteForward();
check("delete forward", d.doc.text() === "bc");
d.undo();
check("undo delete forward", d.doc.text() === "abc");

// ---- list integrity ----
function integrity(doc) {
  let n = doc.head, c = 0;
  while (n !== doc.tail) { if (n.next.prev !== n) return false; n = n.next; c++; }
  return c - 1 === doc.size;
}
check("list integrity", integrity(e.doc) && integrity(f.doc) && integrity(g.doc));

console.log(ok ? "\nALL PASSED" : "\nSOME FAILED");
process.exit(ok ? 0 : 1);
