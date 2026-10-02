"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_js_1 = require("./config/db.js");
const index_js_1 = __importDefault(require("./routes/index.js"));
const error_middleware_js_1 = require("./middleware/error.middleware.js");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
// Connect to MongoDB Atlas
(0, db_js_1.connectDB)();
// Global Middlewares
app.use((0, cors_1.default)({
    origin: CORS_ORIGIN === '*' ? true : [CORS_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
if (process.env.NODE_ENV !== 'test') {
    app.use((0, morgan_1.default)('dev'));
}
// Health Check Endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'UAE Invoicing Node.js Backend',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
    });
});
// Mount All API Endpoints
app.use('/api', index_js_1.default);
// 404 Route Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: `API route not found: ${req.method} ${req.originalUrl}`,
    });
});
// Central Error Handler
app.use(error_middleware_js_1.errorHandler);
const server = app.listen(PORT, () => {
    console.log(`
🚀 ==============================================================
💼 UAE Tax Invoicing Standalone Node.js Backend
📡 Listening on: http://localhost:${PORT}
🌐 CORS Allowed Origin: ${CORS_ORIGIN}
📚 Health Check: http://localhost:${PORT}/health
📁 API Base Path: http://localhost:${PORT}/api
==============================================================
  `);
});
// Graceful Termination
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received. Closing HTTP server gracefully...');
    server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    console.log('SIGINT signal received. Closing HTTP server gracefully...');
    server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
    });
});
exports.default = app;
