import { Router } from "express";
import { BatchStatus, EscrowStatus, OrderStatus, Prisma, Role, TransactionStatus } from "@prisma/client";
import { z } from "zod";
import { blockchainConfig } from "../config/blockchain";
import { prisma } from "../lib/prisma";
import { recordTransaction } from "../lib/transactions";
import { requireApprovedParticipant, requireAuth, requireRoles, AuthenticatedRequest } from "../middleware/auth";

const createOrderSchema = z.object({
  batchId: z.string().uuid(),
  offeredAmount: z.number().positive(),
  amountWei: z.string().min(1),
  conditionNotes: z.string().min(5)
});

const createEscrowSchema = z.object({
  chainEscrowId: z.number().int().positive().optional(),
  txHashCreate: z.string().optional(),
  chainId: z.number().int().default(blockchainConfig.chainId)
});

const updateEscrowSchema = z.object({
  txHash: z.string().optional(),
  chainId: z.number().int().default(blockchainConfig.chainId)
});

export const ordersRouter = Router();

ordersRouter.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  const query = z.object({ status: z.nativeEnum(OrderStatus).optional() }).parse(req.query);

  const where: Prisma.BuyerOrderWhereInput = {
    AND: [
      req.user!.role === Role.ADMIN
        ? {}
        : {
            OR: [{ buyerId: req.user!.id }, { sellerId: req.user!.id }]
          },
      query.status ? { status: query.status } : {}
    ]
  };

  const orders = await prisma.buyerOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      batch: {
        select: {
          id: true,
          batchCode: true,
          status: true,
          chainBatchId: true
        }
      },
      buyer: {
        select: {
          id: true,
          name: true
        }
      },
      seller: {
        select: {
          id: true,
          name: true,
          walletAddress: true
        }
      },
      escrow: true
    }
  });

  res.json({ orders });
});

ordersRouter.post(
  "/",
  requireAuth,
  requireRoles(Role.BUYER),
  requireApprovedParticipant,
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = createOrderSchema.parse(req.body);
      const batch = await prisma.batch.findUnique({
        where: { id: input.batchId },
        include: {
          transfers: {
            orderBy: { createdAt: "desc" },
            take: 1
          }
        }
      });

      if (!batch) {
        return res.status(404).json({ message: "Batch not found." });
      }

      const sellerId = batch.transfers[0]?.toUserId ?? batch.farmerId;

      const order = await prisma.buyerOrder.create({
        data: {
          batchId: batch.id,
          buyerId: req.user!.id,
          sellerId,
          offeredAmount: input.offeredAmount,
          amountWei: input.amountWei,
          conditionNotes: input.conditionNotes,
          status: OrderStatus.ESCROW_PENDING
        }
      });

      res.status(201).json({ order });
    } catch (error) {
      res.status(400).json({ message: "Unable to create retailer order.", error });
    }
  }
);

ordersRouter.post(
  "/:orderId/escrow",
  requireAuth,
  requireRoles(Role.BUYER),
  requireApprovedParticipant,
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = createEscrowSchema.parse(req.body);
      const order = await prisma.buyerOrder.findUnique({ where: { id: String(req.params.orderId) } });

      if (!order) {
        return res.status(404).json({ message: "Order not found." });
      }

      if (order.buyerId !== req.user!.id) {
        return res.status(403).json({ message: "Only the retailer can fund escrow for this order." });
      }

      const escrow = await prisma.escrowRecord.create({
        data: {
          orderId: order.id,
          batchId: order.batchId,
          buyerId: order.buyerId,
          sellerId: order.sellerId,
          amount: order.offeredAmount,
          amountWei: order.amountWei,
          conditionNotes: order.conditionNotes,
          status: EscrowStatus.PENDING,
          chainEscrowId: input.chainEscrowId,
          txHashCreate: input.txHashCreate
        }
      });

      await prisma.buyerOrder.update({
        where: { id: order.id },
        data: { status: OrderStatus.ESCROW_FUNDED }
      });

      await prisma.traceEvent.create({
        data: {
          batchId: order.batchId,
          actorId: req.user!.id,
          eventType: "ESCROW_CREATED",
          details: order.conditionNotes,
          txHash: input.txHashCreate
        }
      });

      await recordTransaction({
        userId: req.user!.id,
        resourceType: "escrow",
        resourceId: escrow.id,
        contractName: "PaymentEscrow",
        methodName: "createEscrow",
        txHash: input.txHashCreate,
        chainId: input.chainId,
        status: input.txHashCreate ? TransactionStatus.CONFIRMED : TransactionStatus.PENDING,
        metadataJson: {
          orderId: order.id,
          batchId: order.batchId
        }
      });

      res.status(201).json({ escrow });
    } catch (error) {
      res.status(400).json({ message: "Unable to create escrow.", error });
    }
  }
);

ordersRouter.get("/escrows/:escrowId", requireAuth, async (req: AuthenticatedRequest, res) => {
  const escrow = await prisma.escrowRecord.findUnique({
    where: { id: String(req.params.escrowId) },
    include: {
      order: true,
      batch: true,
      buyer: { select: { id: true, name: true } },
      seller: { select: { id: true, name: true } }
    }
  });

  if (!escrow) {
    return res.status(404).json({ message: "Escrow not found." });
  }

  if (
    req.user!.role !== Role.ADMIN &&
    req.user!.id !== escrow.buyerId &&
    req.user!.id !== escrow.sellerId
  ) {
    return res.status(403).json({ message: "You do not have access to this escrow." });
  }

  res.json({ escrow });
});

ordersRouter.post(
  "/escrows/:escrowId/confirm-delivery",
  requireAuth,
  requireRoles(Role.BUYER),
  requireApprovedParticipant,
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = updateEscrowSchema.parse(req.body);
      const escrow = await prisma.escrowRecord.findUnique({ where: { id: String(req.params.escrowId) } });

      if (!escrow || escrow.buyerId !== req.user!.id) {
        return res.status(404).json({ message: "Escrow not found for this retailer." });
      }

      const updatedEscrow = await prisma.escrowRecord.update({
        where: { id: escrow.id },
        data: {
          buyerConfirmedDelivery: true
        }
      });

      await prisma.batch.update({
        where: { id: escrow.batchId },
        data: { status: BatchStatus.DELIVERED }
      });

      await prisma.traceEvent.create({
        data: {
          batchId: escrow.batchId,
          actorId: req.user!.id,
          eventType: "DELIVERY_CONFIRMED",
          details: "Buyer confirmed delivery conditions were satisfied.",
          txHash: input.txHash
        }
      });

      await recordTransaction({
        userId: req.user!.id,
        resourceType: "escrow",
        resourceId: escrow.id,
        contractName: "PaymentEscrow",
        methodName: "confirmDelivery",
        txHash: input.txHash,
        chainId: input.chainId,
        status: input.txHash ? TransactionStatus.CONFIRMED : TransactionStatus.PENDING
      });

      res.json({ escrow: updatedEscrow });
    } catch (error) {
      res.status(400).json({ message: "Unable to confirm delivery.", error });
    }
  }
);

ordersRouter.post(
  "/escrows/:escrowId/release",
  requireAuth,
  requireApprovedParticipant,
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = updateEscrowSchema.parse(req.body);
      const escrow = await prisma.escrowRecord.findUnique({ where: { id: String(req.params.escrowId) } });

      if (!escrow) {
        return res.status(404).json({ message: "Escrow not found." });
      }

      if (req.user!.role !== Role.ADMIN && req.user!.id !== escrow.buyerId) {
        return res.status(403).json({ message: "Only the retailer or an admin can release escrow." });
      }

      const updatedEscrow = await prisma.escrowRecord.update({
        where: { id: escrow.id },
        data: {
          status: EscrowStatus.RELEASED,
          resolvedAt: new Date(),
          txHashRelease: input.txHash
        }
      });

      await prisma.buyerOrder.update({
        where: { id: escrow.orderId },
        data: { status: OrderStatus.COMPLETED }
      });

      await prisma.batch.update({
        where: { id: escrow.batchId },
        data: { status: BatchStatus.COMPLETED }
      });

      await prisma.traceEvent.create({
        data: {
          batchId: escrow.batchId,
          actorId: req.user!.id,
          eventType: "ESCROW_RELEASED",
          details: "Escrow funds released after verified delivery and ownership transfer.",
          txHash: input.txHash
        }
      });

      await recordTransaction({
        userId: req.user!.id,
        resourceType: "escrow",
        resourceId: escrow.id,
        contractName: "PaymentEscrow",
        methodName: "releaseEscrow",
        txHash: input.txHash,
        chainId: input.chainId,
        status: input.txHash ? TransactionStatus.CONFIRMED : TransactionStatus.PENDING
      });

      res.json({ escrow: updatedEscrow });
    } catch (error) {
      res.status(400).json({ message: "Unable to release escrow.", error });
    }
  }
);

ordersRouter.post(
  "/escrows/:escrowId/refund",
  requireAuth,
  requireRoles(Role.ADMIN),
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = updateEscrowSchema.parse(req.body);
      const escrow = await prisma.escrowRecord.findUnique({ where: { id: String(req.params.escrowId) } });

      if (!escrow) {
        return res.status(404).json({ message: "Escrow not found." });
      }

      const updatedEscrow = await prisma.escrowRecord.update({
        where: { id: escrow.id },
        data: {
          status: EscrowStatus.REFUNDED,
          resolvedAt: new Date(),
          txHashRefund: input.txHash
        }
      });

      await prisma.buyerOrder.update({
        where: { id: escrow.orderId },
        data: { status: OrderStatus.CANCELLED }
      });

      await prisma.traceEvent.create({
        data: {
          batchId: escrow.batchId,
          actorId: req.user!.id,
          eventType: "ESCROW_REFUNDED",
          details: "Escrow refunded by admin intervention.",
          txHash: input.txHash
        }
      });

      await recordTransaction({
        userId: req.user!.id,
        resourceType: "escrow",
        resourceId: escrow.id,
        contractName: "PaymentEscrow",
        methodName: "refundEscrow",
        txHash: input.txHash,
        chainId: input.chainId,
        status: input.txHash ? TransactionStatus.CONFIRMED : TransactionStatus.PENDING
      });

      res.json({ escrow: updatedEscrow });
    } catch (error) {
      res.status(400).json({ message: "Unable to refund escrow.", error });
    }
  }
);
