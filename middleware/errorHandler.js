const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
    // Log the error
    logger.error('Unhandled error: %o', err);

    // If headers already sent, delegate
    if (res.headersSent) {
        return next(err);
    }

    const status = err.status || 500;
    const response = {
        message: err.message || 'Internal Server Error'
    };

    if (process.env.NODE_ENV !== 'production') {
        response.stack = err.stack;
    }

    res.status(status).json(response);
}

module.exports = errorHandler;
