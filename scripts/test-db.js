const fs = require('fs');
const path = require('path');
const mysql = require('mysql2');
const { buildDbConfig } = require('../src/dbConfig');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) process.env[key] = value;
    }
}

const connection = mysql.createConnection(buildDbConfig());

connection.connect(err => {
    if (err) {
        console.error('Database connection failed:', err.message);
        process.exitCode = 1;
        return;
    }

    console.log('Database connection succeeded.');
    connection.end();
});
