const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { buildDbConfig } = require('../src/dbConfig');

function loadLocalEnv() {
    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) return;

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

function normalizeSqlForManagedDatabase(sql) {
    return sql
        .replace(/^\s*CREATE\s+DATABASE\b[\s\S]*?;\s*/im, '')
        .replace(/^\s*USE\s+[`"]?[\w-]+[`"]?\s*;\s*/im, '');
}

async function main() {
    loadLocalEnv();

    const sqlPath = path.join(__dirname, '..', 'db', 'zhiyinguan.sql');
    const sql = normalizeSqlForManagedDatabase(fs.readFileSync(sqlPath, 'utf8'));
    const connection = await mysql.createConnection(buildDbConfig({ multipleStatements: true }));

    try {
        await connection.query(sql);
        console.log('Database initialized successfully.');
    } finally {
        await connection.end();
    }
}

main().catch((error) => {
    console.error('Database initialization failed:', error.message);
    process.exitCode = 1;
});
