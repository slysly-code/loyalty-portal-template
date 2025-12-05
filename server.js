const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Load configuration
let config;
try {
    config = require('./config.js');
} catch (e) {
    console.error('❌ config.js not found. Copy config.example.js to config.js and configure it.');
    process.exit(1);
}

const PORT = process.env.PORT || 8000;
const SF_DOMAIN = process.env.SF_DOMAIN || config.salesforce.domain;
const CLIENT_ID = process.env.SF_CLIENT_ID || config.salesforce.clientId;
const CLIENT_SECRET = process.env.SF_CLIENT_SECRET || config.salesforce.clientSecret;
const API_VERSION = config.salesforce.apiVersion || 'v65.0';

// Validate configuration
if (!SF_DOMAIN || SF_DOMAIN === 'YOUR_ORG.my.salesforce.com') {
    console.error('❌ Salesforce domain not configured');
    process.exit(1);
}
if (!CLIENT_ID || CLIENT_ID === 'YOUR_CONSUMER_KEY') {
    console.error('❌ Salesforce Client ID not configured');
    process.exit(1);
}

// MIME types for static files
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml'
};

// OAuth token cache
let tokenCache = { token: null, expiry: 0 };

// Get OAuth token using Client Credentials Flow
async function getAccessToken() {
    // Return cached token if still valid
    if (tokenCache.token && Date.now() < tokenCache.expiry) {
        return tokenCache.token;
    }

    return new Promise((resolve, reject) => {
        const postData = `grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`;
        
        const options = {
            hostname: SF_DOMAIN,
            path: '/services/oauth2/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.access_token) {
                        // Cache token (expire 5 minutes early for safety)
                        tokenCache = {
                            token: parsed,
                            expiry: Date.now() + ((parsed.expires_in || 7200) - 300) * 1000
                        };
                        resolve(parsed);
                    } else {
                        reject(new Error(parsed.error_description || 'OAuth failed'));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// Proxy request to Salesforce
async function proxyToSalesforce(apiPath, method, body, res) {
    try {
        const auth = await getAccessToken();
        
        const options = {
            hostname: SF_DOMAIN,
            path: apiPath,
            method: method,
            headers: {
                'Authorization': `Bearer ${auth.access_token}`,
                'Content-Type': 'application/json'
            }
        };

        const proxyReq = https.request(options, (proxyRes) => {
            let data = '';
            proxyRes.on('data', chunk => data += chunk);
            proxyRes.on('end', () => {
                res.writeHead(proxyRes.statusCode, { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(data);
            });
        });

        proxyReq.on('error', (e) => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        });

        if (body) proxyReq.write(body);
        proxyReq.end();
    } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
    }
}

// Serve configuration to frontend
function serveConfig(res) {
    const clientConfig = {
        branding: config.branding,
        language: config.language,
        loyalty: {
            programName: config.loyalty.programName,
            programId: config.loyalty.programId,
            currencies: config.loyalty.currencies,
            eligiblePromotionsProcess: config.loyalty.eligiblePromotionsProcess || 'GetEligiblePromotions'
        },
        demo: config.demo
    };
    res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(clientConfig));
}

// HTTP Server
const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    
    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    // Serve configuration
    if (url.pathname === '/api/config') {
        serveConfig(res);
        return;
    }

    // API proxy endpoint
    if (url.pathname.startsWith('/api/')) {
        let sfPath = url.pathname.replace('/api', `/services/data/${API_VERSION}`) + url.search;
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            proxyToSalesforce(sfPath, req.method, body || null, res);
        });
        return;
    }

    // Static file serving
    let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
    filePath = path.join(__dirname, 'public', filePath);
    
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('Not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n🚀 Loyalty Portal running at http://localhost:${PORT}`);
    console.log(`📡 Connected to: ${SF_DOMAIN}`);
    console.log(`🏷️  Program: ${config.branding.programTitle}`);
    console.log(`\nPress Ctrl+C to stop\n`);
});
