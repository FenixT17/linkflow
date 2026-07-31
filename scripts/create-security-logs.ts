import { Client, Databases, Permission, Role, DatabasesIndexType } from "node-appwrite";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const endpoint = process.env.APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID ?? "linkflow";

if (!projectId || !apiKey) {
  console.error("Missing required environment variables: APPWRITE_PROJECT_ID and APPWRITE_API_KEY");
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run<T>(fn: () => Promise<T>, name: string): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error: unknown) {
    const err = error instanceof Error ? (error as Error & { code?: number }) : undefined;
    if (err?.code === 409 || err?.message?.includes("already exists")) {
      console.log(`   ✓ ${name} already exists, skipping.`);
      return undefined;
    }
    console.error(`   ✗ Failed to create ${name}:`, err?.message ?? error);
    throw error;
  }
}

interface AppwriteAttribute {
  status: string;
  key: string;
}

async function waitForAttributes(collectionId: string, attributeNames: string[]) {
  console.log(`   ↳ Waiting for attributes in ${collectionId}...`);
  let ready = false;
  let attempts = 0;
  while (!ready && attempts < 30) {
    const { attributes } = await databases.listAttributes(databaseId, collectionId);
    const readyNames = (attributes as unknown as AppwriteAttribute[])
      .filter((a) => a.status === "available")
      .map((a) => a.key);
    if (attributeNames.every((name) => readyNames.includes(name))) {
      ready = true;
      break;
    }
    await sleep(1000);
    attempts++;
  }
  if (!ready) {
    console.warn(`   ↳ Some attributes in ${collectionId} were not ready in time.`);
  }
}

async function createSecurityLogs() {
  console.log("🚀 Creating security_logs collection...\n");
  console.log(`📦 Using database: ${databaseId}`);
  console.log(`🔑 Project: ${projectId}\n`);

  // Create collection
  console.log("📋 Creating security_logs collection...");
  await run(
    () =>
      databases.createCollection(
        databaseId,
        "security_logs",
        "Security Logs",
        [
          Permission.read(Role.users()),
          Permission.create(Role.users()),
          Permission.update(Role.users()),
        ],
        true
      ),
    "security_logs collection"
  );

  // Create attributes
  console.log("\n🔧 Creating attributes...");
  await run(
    () => databases.createStringAttribute(databaseId, "security_logs", "userId", 255, true),
    "attribute userId"
  );
  await run(
    () => databases.createStringAttribute(databaseId, "security_logs", "eventType", 64, true),
    "attribute eventType"
  );
  await run(
    () => databases.createStringAttribute(databaseId, "security_logs", "email", 255, false),
    "attribute email"
  );
  await run(
    () => databases.createStringAttribute(databaseId, "security_logs", "ipAddress", 64, false),
    "attribute ipAddress"
  );
  await run(
    () => databases.createStringAttribute(databaseId, "security_logs", "userAgent", 512, false),
    "attribute userAgent"
  );
  await run(
    () => databases.createStringAttribute(databaseId, "security_logs", "metadata", 4096, false),
    "attribute metadata"
  );
  await run(
    () => databases.createDatetimeAttribute(databaseId, "security_logs", "createdAt", true),
    "attribute createdAt"
  );

  // Wait for attributes
  await waitForAttributes("security_logs", [
    "userId", "eventType", "email", "ipAddress",
    "userAgent", "metadata", "createdAt",
  ]);

  // Create indexes
  console.log("\n📊 Creating indexes...");
  await run(
    () => databases.createIndex(databaseId, "security_logs", "idx_security_userId", "key" as DatabasesIndexType, ["userId"]),
    "index idx_security_userId"
  );
  await run(
    () => databases.createIndex(databaseId, "security_logs", "idx_security_eventType", "key" as DatabasesIndexType, ["eventType"]),
    "index idx_security_eventType"
  );
  await run(
    () => databases.createIndex(databaseId, "security_logs", "idx_security_createdAt", "key" as DatabasesIndexType, ["createdAt"]),
    "index idx_security_createdAt"
  );

  console.log("\n✅ security_logs collection created successfully!");
}

createSecurityLogs().catch((error) => {
  console.error("\n❌ Failed:", error.message);
  process.exit(1);
});
