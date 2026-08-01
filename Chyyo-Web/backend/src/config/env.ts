import dotenv from 'dotenv';
dotenv.config();

export const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/chyyo',
  jwtSecret: process.env.JWT_SECRET || 'change_this_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin1234',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
} as const;
