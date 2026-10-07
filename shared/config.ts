import 'dotenv/config';
import { z } from 'zod';
export const config = z.object({
  DATABASE_URL:z.string().url(), REDIS_URL:z.string().url(), ELASTICSEARCH_URL:z.string().url(),
  JWT_ACCESS_SECRET:z.string().min(32), JWT_REFRESH_SECRET:z.string().min(32),
  GOOGLE_CLIENT_ID:z.string().default(''), GOOGLE_CLIENT_SECRET:z.string().default(''),
  GOOGLE_REDIRECT_URI:z.string().url().default('http://localhost:3000/auth/google/callback'),
  PUBLIC_URL:z.string().url().default('http://localhost:3000'), CORS_ORIGIN:z.string().default('http://localhost:5173'),
  PAYMENT_PROVIDER:z.enum(['mock','stripe','razorpay']).default('mock'), PAYMENT_WEBHOOK_SECRET:z.string().min(32),
  STRIPE_SECRET_KEY:z.string().default(''), RAZORPAY_KEY_ID:z.string().default(''), RAZORPAY_KEY_SECRET:z.string().default(''),
  SMTP_HOST:z.string().default(''), SMTP_PORT:z.coerce.number().default(1025), SMTP_FROM:z.string().default('bookings@railflow.local'),
  HOLD_MINUTES:z.coerce.number().int().min(1).max(60).default(15)
}).parse(process.env);
if(config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET) throw new Error('JWT secrets must differ');
