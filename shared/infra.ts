import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Client } from '@elastic/elasticsearch';
import { config } from './config.js';
export const db = new PrismaClient();
export const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest:null });
export const elastic = new Client({ node:config.ELASTICSEARCH_URL });
