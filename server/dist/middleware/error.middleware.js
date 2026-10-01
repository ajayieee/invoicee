"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
function errorHandler(err, req, res, next) {
    console.error('Unhandled Server Error:', err);
    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map((e) => e.message);
        res.status(400).json({
            success: false,
            error: messages[0] || 'Validation error',
            details: messages,
        });
        return;
    }
    // Mongoose duplicate key error (E11000)
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'field';
        res.status(409).json({
            success: false,
            error: `Duplicate value entered for ${field}. It must be unique.`,
        });
        return;
    }
    // Mongoose CastError (invalid ObjectId)
    if (err.name === 'CastError') {
        res.status(400).json({
            success: false,
            error: `Invalid resource identifier format: ${err.value}`,
        });
        return;
    }
    // Default internal server error
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error. Please try again later.',
    });
}
