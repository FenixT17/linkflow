import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import type { StaffApplicationStatus } from "@/lib/types";
import { isStaffApplicationApproved } from "@/lib/staff-security";
import { requireAuth } from "@/lib/auth.server";
import { createServerClient, databaseId } from "@/lib/appwrite.server";

const COLLECTION_STAFF_APPLICATIONS = "staff_applications";

/** GET /api/staff/status — derives userId from the Appwrite session. */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { databases } = createServerClient();
    const docs = await databases.listDocuments(databaseId, COLLECTION_STAFF_APPLICATIONS, [
      Query.equal("userId", auth.user.$id),
      Query.orderDesc("createdAt"),
      Query.limit(1),
    ]);
    const doc = docs.documents[0];
    if (!doc) return NextResponse.json({ application: null });

    const rawStatus = String(doc.status ?? "pending") as StaffApplicationStatus;
    const reviewedBy = doc.reviewedBy ? String(doc.reviewedBy) : undefined;
    const status: StaffApplicationStatus = rawStatus === "rejected"
      ? "rejected"
      : isStaffApplicationApproved({ status: rawStatus, reviewedBy })
        ? "approved"
        : "pending";

    return NextResponse.json({
      application: {
        $id: doc.$id,
        userId: String(doc.userId ?? ""),
        message: String(doc.message ?? ""),
        status,
        reviewedBy,
        createdAt: String(doc.createdAt ?? ""),
      },
    });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: number }).status === "number"
      ? (error as { status: number }).status
      : 500;
    return NextResponse.json({ error: status === 503 ? "Appwrite not configured" : "Failed to fetch staff application" }, { status });
  }
}
