import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // TODO: query Prisma for document by id + workspace_id=orgId
  return NextResponse.json({
    id,
    workspaceId: orgId,
    status: "pending",
    filename: "",
    createdAt: new Date().toISOString(),
  });
}
