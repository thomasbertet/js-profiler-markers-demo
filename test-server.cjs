const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8123;

const server = http.createServer((req, res) => {
  const isCOI = req.url.startsWith('/coi');

  // Always require Document-Policy for JS Self-Profiling
  res.setHeader('Document-Policy', 'js-profiling');

  if (isCOI) {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  }

  let filePath;
  if (req.url === '/coi' || req.url === '/coi/') {
    filePath = path.join(__dirname, 'test.html');
  } else if (req.url === '/' || req.url === '/no-coi' || req.url === '/no-coi/') {
    filePath = path.join(__dirname, 'test.html');
  } else {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.writeHead(200);
  res.end(content);
});

server.listen(PORT, () => {
  console.log(`\nJS Self-Profiling Markers Test Server`);
  console.log(`=====================================`);
  console.log(`\nOpen Chrome with these flags:`);
  console.log(`  --enable-features=ExperimentalJSProfilerMarkers`);
  console.log(`  --enable-experimental-web-platform-features\n`);
  console.log(`Test pages:`);
  console.log(`  COI context:     http://localhost:${PORT}/coi`);
  console.log(`  Non-COI context: http://localhost:${PORT}/no-coi\n`);
  console.log(`Expected results:`);
  console.log(`  COI:     markers include gc, layout, style, paint, script`);
  console.log(`  Non-COI: markers include only layout, style\n`);
});
