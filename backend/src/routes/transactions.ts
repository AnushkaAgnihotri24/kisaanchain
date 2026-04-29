import { Router } from "express";
import { Prisma, Role, TransactionStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRoles, AuthenticatedRequest } from "../middleware/auth";
import { recordTransaction } from "../lib/transactions";

const updateTransactionSchema = z.object({
  status: z.nativeEnum(TransactionStatus),
  blockNumber: z.number().int().nonnegative().optional()
});

const createTransactionSchema = z.object({
  userId: z.string().uuid().optional(),
  resourceType: z.string().min(1),
  resourceId: z.string().optional(),
  contractName: z.string().min(1),
  methodName: z.string().min(1),
  txHash: z.string().min(1),
  chainId: z.number().int().default(31337),
  status: z.nativeEnum(TransactionStatus).default(TransactionStatus.PENDING),
  metadataJson: z.record(z.any()).optional()
});

export const transactionsRouter = Router();

transactionsRouter.post("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const input = createTransactionSchema.parse(req.body);
    const transaction = await recordTransaction({
      userId: input.userId ? String(input.userId) : req.user!.id,
      resourceType: String(input.resourceType),
      resourceId: input.resourceId ? String(input.resourceId) : undefined,
      contractName: String(input.contractName),
      methodName: String(input.methodName),
      txHash: String(input.txHash),
      chainId: Number(input.chainId),
      status: input.status,
      metadataJson: (input.metadataJson ?? undefined) as Prisma.InputJsonValue | undefined
    });

    res.status(201).json({ transaction });
  } catch (error) {
    res.status(400).json({ message: "Unable to record transaction.", error });
  }
});

transactionsRouter.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  const query = z.object({ status: z.nativeEnum(TransactionStatus).optional() }).parse(req.query);
  const where: Prisma.BlockchainTransactionWhereInput = {
    AND: [
      req.user!.role === Role.ADMIN ? {} : { userId: req.user!.id },
      query.status ? { status: query.status } : {}
    ]
  };

  const transactions = await prisma.blockchainTransaction.findMany({
    where,
    orderBy: { createdAt: "desc" }
  });

  res.json({ transactions });
});

transactionsRouter.patch("/:txHash", requireAuth, requireRoles(Role.ADMIN), async (req, res) => {
  try {
    const input = updateTransactionSchema.parse(req.body);
    const transaction = await prisma.blockchainTransaction.update({
      where: { txHash: String(req.params.txHash) },
      data: input
    });

    res.json({ transaction });
  } catch (error) {
    res.status(400).json({ message: "Unable to update transaction status.", error });
  }
});
