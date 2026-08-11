import { createId } from '@paralleldrive/cuid2';

const TICKET_TTL_MS = 30_000;

interface WsTicket {
  profileId: string;
  expiresAt: number;
}

const tickets = new Map<string, WsTicket>();

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
