import { Client, Account, Databases, Storage, ID, Query } from "appwrite";
import { normalizeEnvUrl } from "@/lib/utils";

export const endpoint = normalizeEnvUrl(
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
  "https://cloud.appwrite.io/v1"
);
export const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
export const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "linkflow";
export const filesBucketId = process.env.NEXT_PUBLIC_APPWRITE_FILES_BUCKET_ID ?? "files";

// All browser SDK requests go through our same-origin proxy. The proxy
// attaches the HttpOnly application session cookie server-side, so the
// browser never stores Appwrite session secrets in localStorage.
export const appwriteApiEndpoint =
  typeof window !== "undefined" ? `${window.location.origin}/api/appwrite` : endpoint;
export const appwriteClient = new Client();

if (projectId) {
  appwriteClient.setEndpoint(appwriteApiEndpoint).setProject(projectId);
} else if (typeof window !== "undefined") {
  // Aviso em runtime quando o cliente Appwrite não consegue identificar o projeto.
  // Os botões OAuth continuam a renderizar (UX não quebra) mas o fluxo devolve
  // erro "missing_project" em vez de redirecionar silenciosamente.
  console.warn(
    "[Appwrite] NEXT_PUBLIC_APPWRITE_PROJECT_ID não definido no .env.local.\n" +
      "OAuth (e qualquer chamada autenticada) falhará até preencher o ID.\n" +
      "Também confirme que '" + window.location.hostname + "' está registado como Web Platform no projeto Appwrite."
  );
}

export const account = new Account(appwriteClient);

/** Creates an isolated Cloud client only for the OAuth callback handoff. */
export function createOAuthAccount(): Account {
  const oauthClient = new Client();
  if (projectId) oauthClient.setEndpoint(endpoint).setProject(projectId);
  return new Account(oauthClient);
}

export const databases = new Databases(appwriteClient);
export const storage = new Storage(appwriteClient);

export const Collections = {
  users: "users",
  pages: "pages",
  links: "links",
  analytics: "analytics",
  themes: "themes",
  qrCodes: "qr_codes",
  subscriptions: "subscriptions",
  teams: "teams",
  notifications: "notifications",
  securityLogs: "security_logs",
  activityLogs: "activity_logs",
  staffApplications: "staff_applications",
} as const;

export const Buckets = {
  files: filesBucketId,
} as const;

export { ID, Query };
