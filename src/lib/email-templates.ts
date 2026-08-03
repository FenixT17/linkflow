export interface EmailTemplateContent {
  subject: string;
  html: string;
  text: string;
}

export interface EmailTemplateIdentity {
  name?: string;
}

/** Escape untrusted values before placing them in email HTML. */
export function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeName(name?: string): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed.slice(0, 120) : "Utilizador";
}

function assertSafeActionUrl(actionUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(actionUrl);
  } catch {
    throw new Error("O endereço da ação do email é inválido.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("O endereço da ação do email deve usar HTTP(S).");
  }
  if (parsed.protocol === "http:" && process.env.NODE_ENV === "production") {
    throw new Error("O endereço da ação do email deve usar HTTPS em produção.");
  }

  const configuredSiteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://linkflow-web.netlify.app";
  try {
    const expectedOrigin = new URL(configuredSiteUrl).origin;
    if (parsed.origin !== expectedOrigin) {
      throw new Error("O endereço da ação do email não pertence ao LinkFlow.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("não pertence")) throw error;
    throw new Error("A origem configurada do LinkFlow é inválida.");
  }

  return parsed.toString();
}

function renderLayout(title: string, content: string, actionUrl: string, actionLabel: string): string {
  const safeActionUrl = assertSafeActionUrl(actionUrl);
  return `<!doctype html>
<html lang="pt-PT">
  <body style="margin:0;background:#08090d;color:#f8fafc;font-family:Arial,Helvetica,sans-serif;line-height:1.5">
    <div style="padding:40px 16px">
      <div style="max-width:560px;margin:0 auto;background:#14161d;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:36px;box-shadow:0 20px 60px rgba(0,0,0,.28)">
        <div style="font-size:20px;font-weight:700;letter-spacing:-.02em;margin-bottom:28px">LinkFlow</div>
        <h1 style="font-size:26px;line-height:1.2;margin:0 0 16px;color:#fff">${title}</h1>
        <div style="font-size:15px;color:rgba(255,255,255,.72)">${content}</div>
        <p style="margin:28px 0">
          <a href="${escapeEmailHtml(safeActionUrl)}" style="display:inline-block;background:#fff;color:#111318;text-decoration:none;font-weight:700;border-radius:12px;padding:13px 20px">${escapeEmailHtml(actionLabel)}</a>
        </p>
        <p style="font-size:12px;color:rgba(255,255,255,.42);word-break:break-all">Se o botão não funcionar, copie este endereço:<br>${escapeEmailHtml(safeActionUrl)}</p>
        <p style="font-size:12px;color:rgba(255,255,255,.42);margin:28px 0 0">Este email foi enviado automaticamente pelo LinkFlow. Não responda a esta mensagem.</p>
      </div>
    </div>
  </body>
</html>`;
}

export function renderVerificationEmail(
  identity: EmailTemplateIdentity,
  verificationUrl: string
): EmailTemplateContent {
  const name = normalizeName(identity.name);
  const safeName = escapeEmailHtml(name);
  const title = "Confirme o seu email";
  const content = `<p style="margin:0 0 12px">Olá, ${safeName}.</p><p style="margin:0">Confirme o seu endereço de email para concluir a configuração da sua conta LinkFlow.</p>`;

  return {
    subject: "Confirme o seu email — LinkFlow",
    html: renderLayout(title, content, verificationUrl, "Confirmar email"),
    text: `Olá, ${name}.\n\nConfirme o seu endereço de email para concluir a configuração da sua conta LinkFlow:\n${assertSafeActionUrl(verificationUrl)}\n\nSe não criou esta conta, pode ignorar esta mensagem.`,
  };
}

export function renderPasswordResetEmail(
  identity: EmailTemplateIdentity,
  resetUrl: string
): EmailTemplateContent {
  const name = normalizeName(identity.name);
  const safeName = escapeEmailHtml(name);
  const title = "Redefina a sua palavra-passe";
  const content = `<p style="margin:0 0 12px">Olá, ${safeName}.</p><p style="margin:0">Recebemos um pedido para alterar a palavra-passe da sua conta LinkFlow. Se foi você, use o botão abaixo.</p><p style="margin:12px 0 0;color:rgba(255,255,255,.58)">Se não fez este pedido, ignore este email. A sua palavra-passe não será alterada.</p>`;

  return {
    subject: "Redefina a sua palavra-passe — LinkFlow",
    html: renderLayout(title, content, resetUrl, "Redefinir palavra-passe"),
    text: `Olá, ${name}.\n\nRecebemos um pedido para alterar a palavra-passe da sua conta LinkFlow. Use este endereço para continuar:\n${assertSafeActionUrl(resetUrl)}\n\nSe não fez este pedido, ignore este email. A sua palavra-passe não será alterada.`,
  };
}
