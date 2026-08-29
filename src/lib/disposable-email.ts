/**
 * Domínios conhecidos de email temporário/descartável.
 *
 * A lista é deliberadamente mantida no código para que o registo não dependa
 * de um serviço externo e para que a regra seja igual no browser e no servidor.
 * A validação server-side continua a ser a autoridade final.
 *
 * A lista inicial foi consolidada a partir de listas públicas mantidas pela
 * comunidade, incluindo disposable/disposable-email-domains, e cobre os
 * principais serviços de inbox temporária e aliases conhecidos.
 */
export const DISPOSABLE_EMAIL_ERROR = "Não é possível criar conta com emails temporários ou descartáveis. Use um email pessoal ou profissional.";
export const DISPOSABLE_EMAIL_LOGIN_ERROR = "Não é possível fazer login com emails temporários ou descartáveis. Use um email pessoal ou profissional.";

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "10minutemail.net",
  "10minutemail.org",
  "20minutemail.com",
  "30minutemail.com",
  "33mail.com",
  "1secmail.com",
  "1secmail.net",
  "1secmail.org",
  "anonymbox.com",
  "anonbox.net",
  "burnermail.io",
  "byom.de",
  "cool.fr.nf",
  "courriel.fr.nf",
  "deadaddress.com",
  "deixa.me",
  "discard.email",
  "disposable-mail.com",
  "disposableemail.com",
  "disposablemail.com",
  "dispostable.com",
  "dropmail.me",
  "emailondeck.com",
  "emailtemporanea.net",
  "emailtemporar.ro",
  "emailfake.com",
  "email-fake.com",
  "fakeinbox.com",
  "fakemail.net",
  "getairmail.com",
  "getnada.com",
  "ghostmail.co.uk",
  "grr.la",
  "guerrillamail.biz",
  "guerrillamail.com",
  "guerrillamail.de",
  "guerrillamail.info",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamailblock.com",
  "inboxbear.com",
  "incognitomail.com",
  "instant-email.org",
  "instantmail.fr",
  "jetable.fr.nf",
  "koszmail.pl",
  "mail-temporaire.fr",
  "mail.tm",
  "mail7.app",
  "mail7.io",
  "mailcatch.com",
  "maildrop.cc",
  "mailinater.com",
  "mailinator.com",
  "mailinator.net",
  "mailinator2.com",
  "mailnesia.com",
  "mailnator.com",
  "mailpoof.com",
  "mailsac.com",
  "mintemail.com",
  "mohmal.com",
  "moakt.com",
  "moncourrier.fr.nf",
  "monemail.fr.nf",
  "monmail.fr.nf",
  "my10minutemail.com",
  "mytrashmail.com",
  "nospam.ze.tc",
  "sharklasers.com",
  "spam4.me",
  "spamgourmet.com",
  "tempmail.com",
  "tempmail.io",
  "tempmail.net",
  "tempmail.plus",
  "tempmailo.com",
  "temp-mail.com",
  "temp-mail.io",
  "temp-mail.live",
  "temp-mail.org",
  "tempail.com",
  "tempinbox.com",
  "throwaway.email",
  "throwawaymail.com",
  "trashmail.com",
  "trashmail.de",
  "trashmail.me",
  "trashmail.net",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
]);

function normalizeEmailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0) return "";
  return email.slice(at + 1).trim().toLowerCase().replace(/\.+$/, "");
}

/** Devolve true para um domínio descartável conhecido ou um seu subdomínio. */
export function isDisposableEmail(email: string): boolean {
  const domain = normalizeEmailDomain(email);
  if (!domain) return false;
  return Array.from(DISPOSABLE_EMAIL_DOMAINS).some(
    (blocked) => domain === blocked || domain.endsWith(`.${blocked}`),
  );
}

export function getEmailDomain(email: string): string {
  return normalizeEmailDomain(email);
}

export { DISPOSABLE_EMAIL_DOMAINS };
