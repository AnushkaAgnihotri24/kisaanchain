import bcrypt from "bcryptjs";
import { ApprovalStatus, PrismaClient, Role } from "@prisma/client";
import { env } from "../config/env";

export async function ensureAdminUser(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);

  return prisma.user.upsert({
    where: { email: env.ADMIN_EMAIL },
    update: {
      passwordHash,
      approvalStatus: ApprovalStatus.APPROVED,
      role: Role.ADMIN,
      approvedAt: new Date()
    },
    create: {
      email: env.ADMIN_EMAIL,
      passwordHash,
      name: "KisaanChain Admin",
      role: Role.ADMIN,
      approvalStatus: ApprovalStatus.APPROVED,
      approvedAt: new Date(),
      isOnChainVerified: true
    }
  });
}
