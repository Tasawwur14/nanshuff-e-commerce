const { createLogger, format, transports } = require('winston');
const path = require('path');

const env = process.env.NODE_ENV || 'development';

const loggerTransports = [];

if (env === 'production') {
    loggerTransports.push(
        new transports.File({ filename: path.join(__dirname, '..', 'logs', 'error.log'), level: 'error' }),
        new transports.File({ filename: path.join(__dirname, '..', 'logs', 'combined.log') })
    );
    // also log to console in prod for containerized environments
    loggerTransports.push(new transports.Console({ format: format.json() }));
} else {
    loggerTransports.push(new transports.Console({ format: format.simple() }));
}

const logger = createLogger({
    level: env === 'production' ? 'info' : 'debug',
    format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.splat(),
        format.json()
    ),
    transports: loggerTransports,
    exitOnError: false
});

module.exports = logger;
