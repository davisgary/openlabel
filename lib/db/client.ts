import { Client } from '@neondatabase/serverless';

export function createClient() {
  return new Client({
    connectionString: process.env.DATABASE_URL,
  });
}