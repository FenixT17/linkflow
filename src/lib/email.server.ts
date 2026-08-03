import "server-only";

import { Resend } from "resend";
import type { CreateEmailOptions } from "resend";
import {
  renderPasswordResetEmail,
  renderVerificationEmail,
  type EmailTemplateContent,
} from "./email-templates";

export type EmailTemplate = "verification" | "password_reset" | (string & {});

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string | string[];
  template?: EmailTemplate;
  tags?: Array<{ name: string; value: string }>;
}

export interface SendEmailResult {
  id: string;
}

export interface EmailIdentity {
  name?: string;
}

export interface VerificationEmailInput extends EmailIdentity {
  to: string;
  verificationUrl: string;
}

export interface PasswordResetEmailInput extends EmailIdentity {
  to: string;
  resetUrl: string;
}

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (resendClient) return resendClient;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new EmailServiceError(
      "RESEND_NOT_CONFIGURED",
      "RESEND_API_KEY não está configurada no servidor.",
      503
    );
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

function getFromAddress(): string {
  const configured = process.env.RESEND_FROM_EMAIL?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "LinkFlow <onboarding@resend.dev>";
  throw new EmailServiceError(
    "RESEND_NOT_CONFIGURED",
    "RESEND_FROM_EMAIL não está configurada no servidor.",
    503
  );
}

function getReplyToAddress(): string | string[] | undefined {
  const replyTo = process.env.RESEND_REPLY_TO?.trim();
  return replyTo || undefined;
}

function getErrorDetails(error: unknown): { statusCode?: number; name?: string } {
  if (typeof error === "object" && error !== null) {
    const candidate = error as { statusCode?: unknown; name?: unknown };
    return {
      statusCode: typeof candidate.statusCode === "number" ? candidate.statusCode : undefined,
      name: typeof candidate.name === "string" ? candidate.name : undefined,
    };
  }
  return {};
}

/** Error type that lets API routes distinguish configuration from provider failures. */
export class EmailServiceError extends Error {
  readonly code: "RESEND_NOT_CONFIGURED" | "RESEND_API_ERROR" | "EMAIL_SEND_FAILED";
  readonly status: number;

  constructor(
    code: "RESEND_NOT_CONFIGURED" | "RESEND_API_ERROR" | "EMAIL_SEND_FAILED",
    message: string,
    status = 500
  ) {
    super(message);
    this.name = "EmailServiceError";
    this.code = code;
    this.status = status;
  }
}

function buildPayload(input: SendEmailInput): CreateEmailOptions {
  if (!input.to || (Array.isArray(input.to) && input.to.length === 0)) {
    throw new EmailServiceError("EMAIL_SEND_FAILED", "É necessário indicar um destinatário.", 400);
  }
  if (!input.subject.trim()) {
    throw new EmailServiceError("EMAIL_SEND_FAILED", "É necessário indicar um assunto.", 400);
  }
  if (!input.html && !input.text) {
    throw new EmailServiceError("EMAIL_SEND_FAILED", "É necessário indicar conteúdo HTML ou texto.", 400);
  }

  const base = {
    from: input.from?.trim() || getFromAddress(),
    to: input.to,
    subject: input.subject.trim(),
    replyTo: input.replyTo || getReplyToAddress(),
    tags: input.tags,
  };

  if (input.html && input.text) {
    return { ...base, html: input.html, text: input.text };
  }
  if (input.html) {
    return { ...base, html: input.html };
  }
  return { ...base, text: input.text as string };
}

/**
 * Central email entry point. Keep all Resend calls behind this function so
 * future templates (new login, email change, newsletters, etc.) share the
 * same sender, logging and error handling.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const recipientCount = Array.isArray(input.to) ? input.to.length : 1;

  try {
    const payload = buildPayload(input);
    const { data, error } = await getResendClient().emails.send(payload);

    if (error) {
      const details = getErrorDetails(error);
      console.error("[Email] Resend rejected email", {
        template: input.template ?? "custom",
        recipientCount,
        errorName: details.name,
        statusCode: details.statusCode,
      });
      throw new EmailServiceError("RESEND_API_ERROR", "O serviço de email rejeitou o envio.", details.statusCode || 502);
    }

    if (!data?.id) {
      console.error("[Email] Resend returned no message id", {
        template: input.template ?? "custom",
        recipientCount,
      });
      throw new EmailServiceError("EMAIL_SEND_FAILED", "O serviço de email não confirmou o envio.", 502);
    }

    console.info("[Email] Email sent", {
      id: data.id,
      template: input.template ?? "custom",
      recipientCount,
    });
    return { id: data.id };
  } catch (error) {
    if (error instanceof EmailServiceError) {
      if (error.code === "RESEND_NOT_CONFIGURED") {
        console.error("[Email] Resend is not configured", { code: error.code });
      }
      throw error;
    }

    const details = getErrorDetails(error);
    console.error("[Email] Unexpected send failure", {
      template: input.template ?? "custom",
      recipientCount,
      errorName: details.name,
      statusCode: details.statusCode,
      });
    throw new EmailServiceError("EMAIL_SEND_FAILED", "Não foi possível enviar o email.", 502);
  }
}

function sendTemplateEmail(
  to: string,
  template: EmailTemplate,
  content: EmailTemplateContent,
  tags: Array<{ name: string; value: string }>
) {
  return sendEmail({
    to,
    subject: content.subject,
    html: content.html,
    text: content.text,
    template,
    tags,
  });
}

export function sendVerificationEmail(input: VerificationEmailInput): Promise<SendEmailResult> {
  const content = renderVerificationEmail(input, input.verificationUrl);
  return sendTemplateEmail(input.to, "verification", content, [
    { name: "category", value: "verification" },
  ]);
}

export function sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<SendEmailResult> {
  const content = renderPasswordResetEmail(input, input.resetUrl);
  return sendTemplateEmail(input.to, "password_reset", content, [
    { name: "category", value: "password_reset" },
  ]);
}
