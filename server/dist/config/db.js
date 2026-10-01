"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
const dns_1 = __importDefault(require("dns"));
const mongoose_1 = __importDefault(require("mongoose"));
// Ensure Node.js c-ares uses public DNS resolvers if Windows defaults to loopback (127.0.0.1)
try {
    const currentServers = dns_1.default.getServers();
    if (!currentServers.length || currentServers.every((ip) => ip === '127.0.0.1')) {
        dns_1.default.setServers(['8.8.8.8', '1.1.1.1']);
    }
}
catch {
    dns_1.default.setServers(['8.8.8.8', '1.1.1.1']);
}
async function connectDB() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.warn('⚠️  MONGODB_URI is not defined in environment variables. Falling back to local mongodb://localhost:27017/uae_invoicing');
    }
    const targetUri = uri || 'mongodb://localhost:27017/uae_invoicing';
    try {
        mongoose_1.default.set('strictQuery', false);
        const conn = await mongoose_1.default.connect(targetUri, {
            serverSelectionTimeoutMS: 5000,
            dbName: process.env.MONGODB_DB_NAME || 'uae_invoicing',
        });
        console.log(`✅ MongoDB Connected successfully: ${conn.connection.host} / Database: ${conn.connection.name}`);
    }
    catch (error) {
        console.error(`❌ MongoDB connection error: ${error.message}`);
        process.exit(1);
    }
}
mongoose_1.default.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB connection lost. Reconnecting...');
});
mongoose_1.default.connection.on('error', (err) => {
    console.error('❌ MongoDB runtime error:', err);
});
