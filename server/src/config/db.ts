import dns from 'dns';
import mongoose from 'mongoose';

// Ensure Node.js c-ares uses public DNS resolvers if Windows defaults to loopback (127.0.0.1)
try {
  const currentServers = dns.getServers();
  if (!currentServers.length || currentServers.every((ip) => ip === '127.0.0.1')) {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }
} catch {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn('⚠️  MONGODB_URI is not defined in environment variables. Falling back to local mongodb://localhost:27017/uae_invoicing');
  }

  const targetUri = uri || 'mongodb://localhost:27017/uae_invoicing';

  try {
    mongoose.set('strictQuery', false);
    const conn = await mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: 5000,
      dbName: process.env.MONGODB_DB_NAME || 'uae_invoicing',
    });
    console.log(`✅ MongoDB Connected successfully: ${conn.connection.host} / Database: ${conn.connection.name}`);
  } catch (error: any) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB connection lost. Reconnecting...');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB runtime error:', err);
});
