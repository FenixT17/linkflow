export interface PublicationRecord {
  published?: unknown;
  deleting?: unknown;
  scheduledPublishAt?: unknown;
  scheduledUnpublishAt?: unknown;
}

function parseDate(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

/** Retorna true quando o recurso deve estar público no instante indicado. */
export function isPublicAt(record: unknown, at = Date.now()): boolean {
  const candidate = record && typeof record === "object"
    ? record as PublicationRecord
    : {};
  if (candidate.deleting === true) return false;

  const publishAt = parseDate(candidate.scheduledPublishAt);
  const unpublishAt = parseDate(candidate.scheduledUnpublishAt);

  if (candidate.published !== true && (publishAt === null || publishAt > at)) {
    return false;
  }
  if (unpublishAt !== null && unpublishAt <= at) return false;
  return candidate.published === true || (publishAt !== null && publishAt <= at);
}

/** Retorna true quando um link cujo agendamento já chegou pode ser exibido. */
export function isLinkPublicAt(scheduledFor: unknown, at = Date.now()): boolean {
  if (typeof scheduledFor !== "string" || !scheduledFor.trim()) return true;
  const timestamp = Date.parse(scheduledFor);
  return Number.isFinite(timestamp) && timestamp <= at;
}
