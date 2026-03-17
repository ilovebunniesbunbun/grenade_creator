const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.argv[2] ? parseInt(process.argv[2]) : 60388;
const DATA_FILE = path.join(__dirname, 'grenades.json');

// Memory store for live player data from Lua
let lastPlayerData = { error: "No data received from script yet" };

// Initialize grenades.json if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 4));
}

const server = http.createServer((req, res) => {
    // Basic Request Logging
    const method = req.method;
    const rawUrl = req.url;
    console.log(`[Nade Creator] Incoming: ${method} ${rawUrl}`);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Direct path checking (more reliable than URL object for simple routes)
    const urlParts = rawUrl.split('?');
    const pathname = urlParts[0];
    const searchParams = new URLSearchParams(urlParts[1] || '');
    const action = searchParams.get('action');

    // API: Set Live Player Data (from Lua)
    if (pathname === '/api/player_data' && method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                lastPlayerData = JSON.parse(body);
                console.log(`[Nade Creator] Successfully updated player data (${body.length} bytes)`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                console.error(`[Nade Creator] JSON Parse Error: ${e.message} | Body: ${body}`);
                res.writeHead(400);
                res.end('Invalid JSON');
            }
        });
        return;
    }

    // API: Get/Save Map Data
    if (pathname === '/api/grenades' || action) {
        if (action === 'get_player_data') {
            console.log('[Nade Creator] Dashboard requested player data');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(lastPlayerData));
            return;
        }

        const effectiveAction = action || (pathname === '/api/grenades' ? (method === 'GET' ? 'load' : 'save') : null);
        
        if (effectiveAction === 'load') {
            fs.readFile(DATA_FILE, 'utf8', (err, data) => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(data || '{}');
            });
            return;
        }

        if (effectiveAction === 'save' || effectiveAction === 'save_raw') {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (effectiveAction === 'save_raw') {
                        fs.writeFileSync(DATA_FILE, JSON.stringify(parsed, null, 4));
                    } else {
                        const mapName = parsed.map;
                        delete parsed.map;
                        const currentData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '{}');
                        if (!currentData[mapName]) currentData[mapName] = [];
                        currentData[mapName].push(parsed);
                        fs.writeFileSync(DATA_FILE, JSON.stringify(currentData, null, 4));
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (e) {
                    res.writeHead(500).end('Write Error');
                }
            });
            return;
        }
    }

    // Serve static files
    let fileKey = pathname === '/' ? 'index.html' : pathname;
    let filePath = path.join(__dirname, fileKey);
    
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403).end('Forbidden');
        return;
    }

    const extname = path.extname(filePath);
    let contentType = 'text/html';
    switch (extname) {
        case '.js': contentType = 'text/javascript'; break;
        case '.css': contentType = 'text/css'; break;
        case '.json': contentType = 'application/json'; break;
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(err.code === 'ENOENT' ? 404 : 500).end('File Error');
        } else {
            res.writeHead(200, { 'Content-Type': contentType }).end(content, 'utf8');
        }
    });
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.log(`[Nade Creator] Port ${PORT} already in use. Assuming server is already running.`);
        process.exit(0);
    } else {
        console.error(e);
        process.exit(1);
    }
});

// Explicitly bind to 127.0.0.1 (IPv4) to avoid any IPv6 resolution confusion from Lua
server.listen(PORT, '127.0.0.1', () => {
    console.log(`[Nade Creator] Node.js server running at http://127.0.0.1:${PORT}/`);
});
