import dotenv from 'dotenv';
dotenv.config();

function splitOrigins(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || 'change_this_secret';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin1234';

if (nodeEnv === 'production') {
  const missing: string[] = [];
  if (!process.env.JWT_SECRET || jwtSecret.length < 32 || /change[_ -]?this|replace[_ -]?with|example|secret/i.test(jwtSecret)) missing.push('JWT_SECRET (random, at least 32 characters)');
  if (!process.env.ADMIN_PASSWORD || adminPassword.length < 12 || /admin1234|replace[_ -]?with|example/i.test(adminPassword)) missing.push('ADMIN_PASSWORD (unique, at least 12 characters)');
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (missing.length) throw new Error(`Unsafe production configuration. Set: ${missing.join(', ')}`);
}

export const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv,
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/chyyo',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  adminPassword,
  corsOrigins: splitOrigins(
    process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173'
  ),
} as const;
