/* Tiny static file server — just serves index.html, style.css, app.js.
   Run with: node serve.js   (then open http://localhost:5500) */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 5500;
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript" };

http.createServer((req, res) => {
  let file = req.url === "/" ? "/index.html" : req.url;
  const filePath = path.join(__dirname, file);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": TYPES[ext] || "text/plain" });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Frontend running on http://localhost:${PORT}`));
