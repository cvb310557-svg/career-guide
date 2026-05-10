const fs = require('fs');
const path = require('path');
const mysql = require('mysql2');

const caPath = process.env.DB_SSL_CA || path.join(__dirname, '..', 'certs', 'ca.pem');

const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'zhiguanguan',
    port: Number(process.env.DB_PORT || 3306)
};

if (process.env.DB_SSL === 'true') {
    config.ssl = {
        ca: fs.readFileSync(caPath)
    };
}

const connection = mysql.createConnection(config);

connection.connect(err => {
    if (err) {
        console.error('Database connection failed:', err.message);
        process.exitCode = 1;
        return;
    }

    console.log('Database connection succeeded.');
    connection.end();
});
