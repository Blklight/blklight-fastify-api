import { createId } from '@paralleldrive/cuid2';

const TICKET_TTL_MS = 30_000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

interface WsTicket {
  profileId: string;
  expiresAt: number;
}

const tickets = new Map<string, WsTicket>();

let cleanupTimer: NodeJS.Timeout | null = null;

/**
 * Create a short-lived WebSocket connection ticket for a profile.
 * Tickets are single-use and stored in-memory (single-instance).
 * @param profileId - The profile ID to authorize
 * @returns Ticket string and TTL in seconds
 */
export function createWsTicket(profileId: string): { ticket: string; expiresIn: number } {
  const ticket = createId() + createId();
  tickets.set(ticket, {
    profileId,
    expiresAt: Date.now() + TICKET_TTL_MS,
  });
  return { ticket, expiresIn: TICKET_TTL_MS / 1000 };
}

/**
 * Validate and consume a WebSocket ticket.
 * Expired or unknown tickets are discarded on consumption (no cron needed).
 * @param ticket - The ticket string
 * @returns The authorized profile ID, or null if invalid/expired
 */
export function consumeWsTicket(ticket: string): string | null {
  const entry = tickets.get(ticket);
  tickets.delete(ticket);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    return null;
  }

  return entry.profileId;
}

/**
 * Start periodic GC of expired tickets.
 * Must be called once at server startup; returns a cleanup function to stop the interval.
 */
export function startTicketCleanup(): () => void {
  if (cleanupTimer) return () => stopTicketCleanup();
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ticket, entry] of tickets) {
      if (now > entry.expiresAt) tickets.delete(ticket);
    }
  }, CLEANUP_INTERVAL_MS);
  return () => stopTicketCleanup();
}

/**
 * Stop the periodic GC interval.
 * Called during graceful shutdown to ensure the process is not held open by the timer.
 */
export function stopTicketCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
