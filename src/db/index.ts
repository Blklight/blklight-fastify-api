import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env';

// Single-instance API on node-postgres-style pool: postgres-js defaults are
// max=10, idle_timeout=0 (idle sockets never close) and connect_timeout=30s.
// For a small project the defaults suffice for max, but we pin them all
// explicitly and add an idle timeout so unused pooled connections are released
// instead of piling up on the server.
const client = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
});
export const db = drizzle(client);
