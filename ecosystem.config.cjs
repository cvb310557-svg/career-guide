module.exports = {
    apps: [
        {
            name: 'career-guide',
            script: 'src/server.js',
            env: {
                NODE_ENV: 'production',
                HOST: '127.0.0.1',
                PORT: 3000
            }
        }
    ]
};
