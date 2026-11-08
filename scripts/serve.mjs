// Serves dist/ on http://localhost:8080/timecrunchy/ like GitHub Pages
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.zwo': 'application/xml' };
createServer(async (req, res) => {
	const path = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/timecrunchy\/?/, '/');
	const file = normalize(join(dist, path.endsWith('/') ? `${path}index.html` : path));
	if (!file.startsWith(dist)) return res.writeHead(403).end();
	try {
		res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' }).end(await readFile(file));
	} catch {
		res.writeHead(404).end('Not found');
	}
}).listen(8080, () => console.log('http://localhost:8080/timecrunchy/'));
