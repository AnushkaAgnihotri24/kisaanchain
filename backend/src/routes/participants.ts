import { Router } from "express";
import { ApprovalStatus, Prisma, Role, TransactionStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordTransaction } from "../lib/transactions";
import { requireApprovedParticipant, requireAuth, requireRoles, AuthenticatedRequest } from "../middleware/auth";

const requestSchema = z.object({
  participantMeta: z.string().min(1),
  chainParticipantId: z.number().int().positive().optional(),
  txHash: z.string().min(1).optional(),
  chainId: z.number().int().default(31337)
});

const approveSchema = z.object({
  approved: z.boolean(),
  notes: z.string().optional(),
  chainParticipantId: z.number().int().positive().optional(),
  txHash: z.string().min(1).optional(),
  chainId: z.number().int().default(31337)
});

export const participantsRouter = Router();

participantsRouter.get("/", requireAuth, async (req, res) => {
  const query = z
    .object({
      q: z.string().optional(),
      role: z.nativeEnum(Role).optional(),
      approvalStatus: z.nativeEnum(ApprovalStatus).optional()
    })
    .parse(req.query);

  const where: Prisma.UserWhereInput = {
    AND: [
      query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { email: { contains: query.q, mode: "insensitive" } },
              { walletAddress: { contains: query.q, mode: "insensitive" } }
            ]
          }
        : {},
      query.role ? { role: query.role } : {},
      query.approvalStatus ? { approvalStatus: query.approvalStatus } : {}
    ]
  };

  const participants = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      approvalStatus: true,
      walletAddress: true,
      organization: true,
      location: true,
      isOnChainVerified: true,
      approvedAt: true,
      createdAt: true
    }
  });

  res.json({ participants });
});

participantsRouter.get("/pending", requireAuth, requireRoles(Role.ADMIN), async (_req, res) => {
  const participants = await prisma.user.findMany({
    where: { approvalStatus: ApprovalStatus.PENDING },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      walletAddress: true,
      participantMeta: true,
      createdAt: true
    }
  });

  res.json({ participants });
});

participantsRouter.post("/request", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const input = requestSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        participantMeta: input.participantMeta,
        chainParticipantId: input.chainParticipantId,
        approvalStatus: req.user!.role === Role.CONSUMER ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING
      }
    });

    await recordTransaction({
      userId: user.id,
      resourceType: "participant",
      resourceId: user.id,
      contractName: "ParticipantRegistry",
      methodName: "requestRegistration",
      txHash: input.txHash,
      chainId: input.chainId,
      status: TransactionStatus.PENDING,
      metadataJson: {
        role: user.role,
        participantMeta: input.participantMeta
      }
    });

    res.json({
      message: "Participant request submitted.",
      participant: {
        id: user.id,
        role: user.role,
        approvalStatus: user.approvalStatus,
        participantMeta: user.participantMeta
      }
    });
  } catch (error) {
    res.status(400).json({ message: "Unable to submit participant request.", error });
  }
});

participantsRouter.post("/:id/approve", requireAuth, requireRoles(Role.ADMIN), async (req, res) => {
  try {
    const input = approveSchema.parse(req.body);
    const participantId = String(req.params.id);
    const participant = await prisma.user.update({
      where: { id: participantId },
      data: {
        approvalStatus: input.approved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
        approvedAt: input.approved ? new Date() : null,
        chainParticipantId: input.chainParticipantId,
        isOnChainVerified: input.approved
      }
    });

    await recordTransaction({
      userId: participant.id,
      resourceType: "participant",
      resourceId: participant.id,
      contractName: "ParticipantRegistry",
      methodName: "verifyParticipant",
      txHash: input.txHash,
      chainId: input.chainId,
      status: input.approved ? TransactionStatus.CONFIRMED : TransactionStatus.FAILED,
      metadataJson: {
        approved: input.approved,
        notes: input.notes || ""
      }
    });

    res.json({ participant });
  } catch (error) {
    res.status(400).json({ message: "Unable to update participant approval.", error });
  }
});

participantsRouter.get("/me/status", requireAuth, requireApprovedParticipant, async (req: AuthenticatedRequest, res) => {
  res.json({ approved: true, role: req.user!.role });
});
