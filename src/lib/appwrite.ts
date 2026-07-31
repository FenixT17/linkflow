import { Client, Account, Databases, Storage, ID, Query } from "appwrite";

export const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
export const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
export const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "linkflow";
export const filesBucketId = process.env.NEXT_PUBLIC_APPWRITE_FILES_BUCKET_ID ?? "files";

export const appwriteClient = new Client();

if (projectId) {
  appwriteClient.setEndpoint(endpoint).setProject(projectId);
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
} as const;

export const Buckets = {
  files: filesBucketId,
} as const;

export { ID, Query };
