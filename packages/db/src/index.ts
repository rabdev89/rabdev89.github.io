import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function withWorkspaceRls<T>(
  workspaceId: string,
  fn: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL "app.current_workspace_id" = '${workspaceId.replace(/'/g, "''")}'`
    );
    return fn(tx as unknown as PrismaClient);
  });
}

export * from "@prisma/client";
