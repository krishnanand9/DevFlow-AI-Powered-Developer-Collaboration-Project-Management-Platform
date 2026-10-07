import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';
const secret = (name: string, dev: string) => {
  const v = process.env[name];
  if (!v && isProd) throw new Error(`${name} must be set in production`);
  return v || dev;
};

export const env = {
  isProd,
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/devflow',
  accessSecret: secret('JWT_ACCESS_SECRET', 'dev-access-secret'),
  refreshSecret: secret('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  aiUrl: process.env.AI_ENGINE_URL || 'http://localhost:8000',
  aiKey: process.env.AI_INTERNAL_KEY || 'dev-internal-key',
};
