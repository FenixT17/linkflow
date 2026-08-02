import type { StaffApplicationStatus } from "./types";

const MIN_STAFF_MESSAGE_LENGTH = 20;
const MAX_STAFF_MESSAGE_LENGTH = 4000;

/** Normalizes and validates untrusted staff-application text. */
export function normalizeStaffApplicationMessage(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Mensagem de candidatura inválida.");
  }

  const message = value.trim().slice(0, MAX_STAFF_MESSAGE_LENGTH);
  if (message.length < MIN_STAFF_MESSAGE_LENGTH) {
    throw new Error("Explica um pouco mais porque queres fazer parte do staff (mín. 20 caracteres).");
  }
  return message;
}

/**
 * An application is approvable only after a trusted reviewer is recorded.
 * `reviewedBy` is written by the team/server, never by the client.
 */
export function isStaffApplicationApproved(application: {
  status: StaffApplicationStatus | string;
  reviewedBy?: string | null;
}): boolean {
  // The server route/Console workflow must populate reviewedBy with a
  // trusted team identity. This predicate is intentionally conservative;
  // legacy approvals are invalidated by the migration script.
  return application.status === "approved" && Boolean(application.reviewedBy?.trim());
}
