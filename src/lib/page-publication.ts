export interface PublicationRecord {
  publicado?: unknown;
  aEliminar?: unknown;
  publicacaoAgendadaEm?: unknown;
  despublicacaoAgendadaEm?: unknown;
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
  if (candidate.aEliminar === true) return false;

  const publishAt = parseDate(candidate.publicacaoAgendadaEm);
  const unpublishAt = parseDate(candidate.despublicacaoAgendadaEm);

  if (candidate.publicado !== true && (publishAt === null || publishAt > at)) {
    return false;
  }
  if (unpublishAt !== null && unpublishAt <= at) return false;
  return candidate.publicado === true || (publishAt !== null && publishAt <= at);
}

/** Retorna true quando um link cujo agendamento já chegou pode ser exibido. */
export function isLinkPublicAt(agendadoPara: unknown, at = Date.now()): boolean {
  if (typeof agendadoPara !== "string" || !agendadoPara.trim()) return true;
  const timestamp = Date.parse(agendadoPara);
  return Number.isFinite(timestamp) && timestamp <= at;
}
