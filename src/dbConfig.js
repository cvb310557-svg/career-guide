const fs = require('fs');
const path = require('path');

function firstValue(...values) {
    return values.find((value) => value !== undefined && value !== null && value !== '');
}

function buildDbConfig(options = {}) {
    const config = {
        host: firstValue(process.env.DB_HOST, process.env.MYSQLHOST, 'localhost'),
        user: firstValue(process.env.DB_USER, process.env.MYSQLUSER, 'root'),
        password: firstValue(process.env.DB_PASSWORD, process.env.MYSQLPASSWORD, ''),
        database: firstValue(process.env.DB_NAME, process.env.MYSQLDATABASE, 'zhiguanguan'),
        port: Number(firstValue(process.env.DB_PORT, process.env.MYSQLPORT, 3306)),
        waitForConnections: true,
        connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
        ...options
    };

    if (process.env.DB_SSL === 'true') {
        const caPath = process.env.DB_SSL_CA || path.join(__dirname, '..', 'certs', 'ca.pem');
        config.ssl = fs.existsSync(caPath) ? { ca: fs.readFileSync(caPath) } : {};
    }

    return config;
}

module.exports = {
    buildDbConfig
};
