import dotenv from 'dotenv';
dotenv.config();

function splitOrigins(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/chyyo',
  jwtSecret: process.env.JWT_SECRET || 'change_this_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin1234',
  corsOrigins: splitOrigins(
    process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173'
  ),
} as const;
