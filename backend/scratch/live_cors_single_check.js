const https = require('https');

const options = {
    hostname: 'camporastudent.onrender.com',
    port: 443,
    path: '/api/properties/search?sort=rating&limit=6',
    method: 'OPTIONS',
    headers: {
        'Origin': 'https://camporastudent.vercel.app',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'content-type',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Connection': 'keep-alive'
    }
};

const req = https.request(options, (res) => {
    console.log("STATUS:", res.statusCode);
    console.log("HEADERS:", res.headers);
});

req.on('error', (e) => {
    console.error("ERROR:", e);
});

req.end();
