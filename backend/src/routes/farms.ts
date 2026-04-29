import { Router } from "express";
import { Prisma, Role, TransactionStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordTransaction } from "../lib/transactions";
import { requireApprovedParticipant, requireAuth, requireRoles, AuthenticatedRequest } from "../middleware/auth";

const createFarmSchema = z.object({
  farmName: z.string().min(2),
  location: z.string().min(2),
  cropType: z.string().min(2),
  geoCoordinates: z.string().optional(),
  areaHectares: z.number().positive().optional(),
  metadataUri: z.string().optional(),
  chainFarmId: z.number().int().positive().optional(),
  txHash: z.string().optional(),
  chainId: z.number().int().default(31337)
});

export const farmsRouter = Router();

farmsRouter.get("/", async (req, res) => {
  const query = z.object({ q: z.string().optional(), ownerId: z.string().optional() }).parse(req.query);
  const where: Prisma.FarmWhereInput = {
    AND: [
      query.ownerId ? { ownerId: query.ownerId } : {},
      query.q
        ? {
            OR: [
              { farmName: { contains: query.q, mode: "insensitive" } },
              { location: { contains: query.q, mode: "insensitive" } },
              { cropType: { contains: query.q, mode: "insensitive" } }
            ]
          }
        : {}
    ]
  };

  const farms = await prisma.farm.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          walletAddress: true
        }
      },
      _count: {
        select: {
          batches: true
        }
      }
    }
  });

  res.json({ farms });
});

farmsRouter.post(
  "/",
  requireAuth,
  requireRoles(Role.FARMER, Role.ADMIN),
  requireApprovedParticipant,
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = createFarmSchema.parse(req.body);

      const farm = await prisma.farm.create({
        data: {
          ownerId: req.user!.id,
          farmName: input.farmName,
          location: input.location,
          cropType: input.cropType,
          geoCoordinates: input.geoCoordinates,
          areaHectares: input.areaHectares,
          metadataUri: input.metadataUri,
          chainFarmId: input.chainFarmId,
          txHash: input.txHash
        }
      });

      await recordTransaction({
        userId: req.user!.id,
        resourceType: "farm",
        resourceId: farm.id,
        contractName: "FarmRegistration",
        methodName: "registerFarm",
        txHash: input.txHash,
        chainId: input.chainId,
        status: input.txHash ? TransactionStatus.CONFIRMED : TransactionStatus.PENDING,
        metadataJson: {
          farmName: input.farmName,
          cropType: input.cropType
        }
      });

      res.status(201).json({ farm });
    } catch (error) {
      res.status(400).json({ message: "Unable to create farm.", error });
    }
  }
);

farmsRouter.get("/:id", async (req, res) => {
  const farm = await prisma.farm.findUnique({
    where: { id: req.params.id },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          walletAddress: true,
          role: true
        }
      },
      batches: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!farm) {
    return res.status(404).json({ message: "Farm not found." });
  }

  res.json({ farm });
});
