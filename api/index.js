const https = require('https');

const SF_DOMAIN = process.env.SF_DOMAIN;
const CLIENT_ID = process.env.SF_CLIENT_ID;
const CLIENT_SECRET = process.env.SF_CLIENT_SECRET;
const API_VERSION = process.env.SF_API_VERSION || 'v65.0';

let tokenCache = { token: null, expiry: 0 };

async function getAccessToken() {
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

async function proxyToSalesforce(sfPath, method, body) {
    const auth = await getAccessToken();
    
    return new Promise((resolve, reject) => {
        const options = {
            hostname: SF_DOMAIN,
            path: sfPath,
            method: method,
            headers: {
                'Authorization': `Bearer ${auth.access_token}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
        });

        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.url === '/api/config') {
        res.json({
            branding: {
                companyName: process.env.COMPANY_NAME || 'Loyalty Program',
                programTitle: process.env.PROGRAM_TITLE || 'Rewards',
                primaryColor: process.env.PRIMARY_COLOR || '#0066CC',
                secondaryColor: process.env.SECONDARY_COLOR || '#004499'
            },
            language: process.env.LANGUAGE || 'en',
            loyalty: {
                programName: process.env.PROGRAM_NAME || '',
                programId: process.env.PROGRAM_ID || '',
                currencies: {
                    qualifying: process.env.QUALIFYING_CURRENCY || null,
                    nonQualifying: process.env.NON_QUALIFYING_CURRENCY || null
                },
                eligiblePromotionsProcess: process.env.ELIGIBLE_PROMOTIONS_PROCESS || 'GetEligiblePromotions'
            },
            demo: {
                enabled: process.env.DEMO_ENABLED === 'true',
                autoUnenrollMemberId: process.env.DEMO_MEMBER_ID || null,
                autoUnenrollPromotionId: process.env.DEMO_PROMOTION_ID || null
            }
        });
        return;
    }

    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const sfPath = url.pathname.replace('/api', `/services/data/${API_VERSION}`) + url.search;
        
        let body = null;
        if (req.method === 'POST') {
            body = JSON.stringify(req.body);
        }

        const result = await proxyToSalesforce(sfPath, req.method, body);
        res.status(result.statusCode).send(result.body);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
