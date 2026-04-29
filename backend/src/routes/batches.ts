import { Router } from "express";
import { ApprovalStatus, BatchStatus, Prisma, Role, TransactionStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { generateQrDataUrl } from "../lib/qr";
import { recordTransaction } from "../lib/transactions";
import { requireApprovedParticipant, requireAuth, requireRoles, AuthenticatedRequest } from "../middleware/auth";

const createBatchSchema = z.object({
  farmId: z.string().uuid(),
  batchCode: z.string().min(3),
  harvestDate: z.string().datetime(),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  metadataUri: z.string().optional(),
  chainBatchId: z.number().int().positive().optional(),
  txHash: z.string().optional(),
  chainId: z.number().int().default(31337)
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(BatchStatus),
  txHash: z.string().optional(),
  chainId: z.number().int().default(31337)
});

const transformationSchema = z.object({
  transformationType: z.string().min(2),
  details: z.string().min(2),
  metadataUri: z.string().optional(),
  chainTransformationId: z.number().int().positive().optional(),
  txHash: z.string().optional(),
  chainId: z.number().int().default(31337)
});

const certificateSchema = z.object({
  certificateType: z.string().min(2),
  documentCid: z.string().min(4),
  metadataUri: z.string().optional(),
  chainCertificateId: z.number().int().positive().optional(),
  txHashCreate: z.string().optional(),
  chainId: z.number().int().default(31337)
});

const verifyCertificateSchema = z.object({
  txHashVerify: z.string().optional(),
  chainId: z.number().int().default(31337)
});

const transferSchema = z.object({
  toUserId: z.string().uuid(),
  details: z.string().min(2),
  chainTransferId: z.number().int().positive().optional(),
  txHash: z.string().optional(),
  chainId: z.number().int().default(31337)
});

const traceEventSchema = z.object({
  eventType: z.string().min(2),
  details: z.string().min(2),
  metadataUri: z.string().optional(),
  txHash: z.string().optional(),
  chainId: z.number().int().default(31337)
});

export const batchesRouter = Router();

batchesRouter.get("/certificates", async (req, res) => {
  const query = z
    .object({
      status: z.enum(["verified", "unverified"]).optional()
    })
    .parse(req.query);

  const certificates = await prisma.certificate.findMany({
    where:
      query.status === "verified"
        ? { isVerified: true }
        : query.status === "unverified"
          ? { isVerified: false }
          : {},
    include: {
      batch: {
        select: {
          id: true,
          batchCode: true
        }
      },
      issuer: {
        select: {
          id: true,
          name: true,
          role: true
        }
      },
      verifier: {
        select: {
          id: true,
          name: true,
          role: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  res.json({ certificates });
});

batchesRouter.get("/certificates/:certificateId", async (req, res) => {
  const certificate = await prisma.certificate.findUnique({
    where: { id: String(req.params.certificateId) },
    include: {
      batch: {
        include: {
          farm: true,
          farmer: {
            select: {
              id: true,
              name: true
            }
          }
        }
      },
      issuer: {
        select: {
          id: true,
          name: true,
          role: true
        }
      },
      verifier: {
        select: {
          id: true,
          name: true,
          role: true
        }
      }
    }
  });

  if (!certificate) {
    return res.status(404).json({ message: "Certificate not found." });
  }

  res.json({ certificate });
});

batchesRouter.get("/", async (req, res) => {
  const query = z
    .object({
      q: z.string().optional(),
      status: z.nativeEnum(BatchStatus).optional(),
      certificationStatus: z.enum(["verified", "unverified"]).optional(),
      sort: z.enum(["newest", "oldest"]).default("newest")
    })
    .parse(req.query);

  const where: Prisma.BatchWhereInput = {
    AND: [
      query.q
        ? {
            OR: [
              { batchCode: { contains: query.q, mode: "insensitive" } },
              { farm: { farmName: { contains: query.q, mode: "insensitive" } } },
              { farm: { location: { contains: query.q, mode: "insensitive" } } }
            ]
          }
        : {},
      query.status ? { status: query.status } : {},
      query.certificationStatus === "verified"
        ? { certificates: { some: { isVerified: true } } }
        : query.certificationStatus === "unverified"
          ? { certificates: { none: { isVerified: true } } }
          : {}
    ]
  };

  const batches = await prisma.batch.findMany({
    where,
    orderBy: { createdAt: query.sort === "oldest" ? "asc" : "desc" },
    include: {
      farm: {
        select: {
          id: true,
          farmName: true,
          location: true
        }
      },
      farmer: {
        select: {
          id: true,
          name: true,
          walletAddress: true
        }
      },
      certificates: {
        select: {
          id: true,
          isVerified: true
        }
      },
      transfers: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          toUser: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  });

  res.json({ batches });
});

batchesRouter.post(
  "/",
  requireAuth,
  requireRoles(Role.FARMER, Role.ADMIN),
  requireApprovedParticipant,
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = createBatchSchema.parse(req.body);
      const farm = await prisma.farm.findUnique({ where: { id: input.farmId } });

      if (!farm) {
        return res.status(404).json({ message: "Farm not found." });
      }

      if (req.user!.role !== Role.ADMIN && farm.ownerId !== req.user!.id) {
        return res.status(403).json({ message: "You can only create batches for your own farm." });
      }

      const batch = await prisma.batch.create({
        data: {
          farmId: input.farmId,
          farmerId: farm.ownerId,
          batchCode: input.batchCode,
          harvestDate: new Date(input.harvestDate),
          quantity: input.quantity,
          unit: input.unit,
          metadataUri: input.metadataUri,
          chainBatchId: input.chainBatchId,
          txHash: input.txHash
        }
      });

      await prisma.traceEvent.create({
        data: {
          batchId: batch.id,
          actorId: req.user!.id,
          eventType: "BATCH_CREATED",
          details: `Batch ${input.batchCode} created after harvest.`,
          metadataUri: input.metadataUri,
          txHash: input.txHash
        }
      });

      await recordTransaction({
        userId: req.user!.id,
        resourceType: "batch",
        resourceId: batch.id,
        contractName: "BatchCreation",
        methodName: "createBatch",
        txHash: input.txHash,
        chainId: input.chainId,
        status: input.txHash ? TransactionStatus.CONFIRMED : TransactionStatus.PENDING,
        metadataJson: {
          batchCode: input.batchCode,
          chainBatchId: input.chainBatchId || null
        }
      });

      res.status(201).json({ batch });
    } catch (error) {
      res.status(400).json({ message: "Unable to create batch.", error });
    }
  }
);

batchesRouter.get("/:id", async (req, res) => {
  const batch = await prisma.batch.findUnique({
    where: { id: String(req.params.id) },
    include: {
      farm: {
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              walletAddress: true
            }
          }
        }
      },
      farmer: {
        select: {
          id: true,
          name: true,
          walletAddress: true
        }
      },
      transformations: {
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              role: true
            }
          }
        },
        orderBy: { createdAt: "asc" }
      },
      transfers: {
        include: {
          fromUser: {
            select: {
              id: true,
              name: true,
              role: true
            }
          },
          toUser: {
            select: {
              id: true,
              name: true,
              role: true
            }
          }
        },
        orderBy: { createdAt: "asc" }
      },
      certificates: {
        include: {
          issuer: {
            select: {
              id: true,
              name: true,
              role: true
            }
          },
          verifier: {
            select: {
              id: true,
              name: true,
              role: true
            }
          }
        },
        orderBy: { createdAt: "asc" }
      },
      traceEvents: {
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              role: true
            }
          }
        },
        orderBy: { occurredAt: "asc" }
      },
      orders: {
        include: {
          buyer: {
            select: {
              id: true,
              name: true
            }
          },
          escrow: true
        },
        orderBy: { createdAt: "desc" }
      },
      qrVerification: true
    }
  });

  if (!batch) {
    return res.status(404).json({ message: "Batch not found." });
  }

  const latestTransfer = batch.transfers[batch.transfers.length - 1];
  const currentOwner = latestTransfer?.toUser ?? batch.farmer;

  res.json({ batch, currentOwner });
});

batchesRouter.patch(
  "/:id/status",
  requireAuth,
  requireRoles(Role.FARMER, Role.ADMIN),
  requireApprovedParticipant,
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = updateStatusSchema.parse(req.body);
      const batchId = String(req.params.id);
      const batch = await prisma.batch.findUnique({ where: { id: batchId } });

      if (!batch) {
        return res.status(404).json({ message: "Batch not found." });
      }

      if (req.user!.role !== Role.ADMIN && batch.farmerId !== req.user!.id) {
        return res.status(403).json({ message: "Only the batch farmer or an admin can update status." });
      }

      const updatedBatch = await prisma.batch.update({
        where: { id: batchId },
        data: { status: input.status }
      });

      await prisma.traceEvent.create({
        data: {
          batchId: updatedBatch.id,
          actorId: req.user!.id,
          eventType: "STATUS_UPDATED",
          details: `Batch status set to ${input.status}.`,
          txHash: input.txHash
        }
      });

      await recordTransaction({
        userId: req.user!.id,
        resourceType: "batch",
        resourceId: updatedBatch.id,
        contractName: "BatchCreation",
        methodName: "updateBatchStatus",
        txHash: input.txHash,
        chainId: input.chainId,
        status: input.txHash ? TransactionStatus.CONFIRMED : TransactionStatus.PENDING,
        metadataJson: { status: input.status }
      });

      res.json({ batch: updatedBatch });
    } catch (error) {
      res.status(400).json({ message: "Unable to update batch status.", error });
    }
  }
);

batchesRouter.post(
  "/:id/transformations",
  requireAuth,
  requireApprovedParticipant,
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = transformationSchema.parse(req.body);
      const batch = await prisma.batch.findUnique({ where: { id: String(req.params.id) } });

      if (!batch) {
        return res.status(404).json({ message: "Batch not found." });
      }

      const transformation = await prisma.transformation.create({
        data: {
          batchId: batch.id,
          actorId: req.user!.id,
          transformationType: input.transformationType,
          details: input.details,
          metadataUri: input.metadataUri,
          txHash: input.txHash,
          chainTransformationId: input.chainTransformationId
        }
      });

      await prisma.traceEvent.create({
        data: {
          batchId: batch.id,
          actorId: req.user!.id,
          eventType: input.transformationType,
          details: input.details,
          metadataUri: input.metadataUri,
          txHash: input.txHash
        }
      });

      await recordTransaction({
        userId: req.user!.id,
        resourceType: "transformation",
        resourceId: transformation.id,
        contractName: "BatchTransformation",
        methodName: "recordTransformation",
        txHash: input.txHash,
        chainId: input.chainId,
        status: input.txHash ? TransactionStatus.CONFIRMED : TransactionStatus.PENDING,
        metadataJson: {
          batchId: batch.id,
          transformationType: input.transformationType
        }
      });

      res.status(201).json({ transformation });
    } catch (error) {
      res.status(400).json({ message: "Unable to record transformation.", error });
    }
  }
);

batchesRouter.post(
  "/:id/certificates",
  requireAuth,
  requireRoles(Role.FARMER, Role.CERTIFIER, Role.ADMIN),
  requireApprovedParticipant,
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = certificateSchema.parse(req.body);
      const batch = await prisma.batch.findUnique({ where: { id: String(req.params.id) } });

      if (!batch) {
        return res.status(404).json({ message: "Batch not found." });
      }

      const certificate = await prisma.certificate.create({
        data: {
          batchId: batch.id,
          issuerId: req.user!.id,
          certificateType: input.certificateType,
          documentCid: input.documentCid,
          metadataUri: input.metadataUri,
          chainCertificateId: input.chainCertificateId,
          txHashCreate: input.txHashCreate
        }
      });

      await prisma.traceEvent.create({
        data: {
          batchId: batch.id,
          actorId: req.user!.id,
          eventType: "CERTIFICATE_UPLOADED",
          details: `${input.certificateType} certificate added.`,
          metadataUri: input.documentCid,
          txHash: input.txHashCreate
        }
      });

      await recordTransaction({
        userId: req.user!.id,
        resourceType: "certificate",
        resourceId: certificate.id,
        contractName: "CertificateVerification",
        methodName: "addCertificate",
        txHash: input.txHashCreate,
        chainId: input.chainId,
        status: input.txHashCreate ? TransactionStatus.CONFIRMED : TransactionStatus.PENDING,
        metadataJson: {
          batchId: batch.id,
          certificateType: input.certificateType,
          documentCid: input.documentCid
        }
      });

      res.status(201).json({ certificate });
    } catch (error) {
      res.status(400).json({ message: "Unable to add certificate.", error });
    }
  }
);

batchesRouter.post(
  "/certificates/:certificateId/verify",
  requireAuth,
  requireRoles(Role.CERTIFIER, Role.ADMIN),
  requireApprovedParticipant,
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = verifyCertificateSchema.parse(req.body);
      const certificate = await prisma.certificate.update({
        where: { id: String(req.params.certificateId) },
        data: {
          isVerified: true,
          verifierId: req.user!.id,
          verifiedAt: new Date(),
          txHashVerify: input.txHashVerify
        }
      });

      await prisma.batch.update({
        where: { id: certificate.batchId },
        data: { status: BatchStatus.CERTIFIED }
      });

      await prisma.traceEvent.create({
        data: {
          batchId: certificate.batchId,
          actorId: req.user!.id,
          eventType: "CERTIFICATE_VERIFIED",
          details: `${certificate.certificateType} certificate verified.`,
          metadataUri: certificate.documentCid,
          txHash: input.txHashVerify
        }
      });

      await recordTransaction({
        userId: req.user!.id,
        resourceType: "certificate",
        resourceId: certificate.id,
        contractName: "CertificateVerification",
        methodName: "verifyCertificate",
        txHash: input.txHashVerify,
        chainId: input.chainId,
        status: input.txHashVerify ? TransactionStatus.CONFIRMED : TransactionStatus.PENDING,
        metadataJson: {
          certificateId: certificate.id
        }
      });

      res.json({ certificate });
    } catch (error) {
      res.status(400).json({ message: "Unable to verify certificate.", error });
    }
  }
);

batchesRouter.post(
  "/:id/transfers",
  requireAuth,
  requireApprovedParticipant,
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = transferSchema.parse(req.body);
      const batchId = String(req.params.id);
      const batch = await prisma.batch.findUnique({
        where: { id: batchId },
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

      const currentOwnerId = batch.transfers[0]?.toUserId ?? batch.farmerId;
      if (req.user!.role !== Role.ADMIN && currentOwnerId !== req.user!.id) {
        return res.status(403).json({ message: "Only the current owner or admin can transfer a batch." });
      }

      const recipient = await prisma.user.findUnique({ where: { id: input.toUserId } });
      if (!recipient || recipient.approvalStatus !== ApprovalStatus.APPROVED) {
        return res.status(400).json({ message: "Recipient must be an approved participant." });
      }

      const transfer = await prisma.transfer.create({
        data: {
          batchId: batch.id,
          fromUserId: currentOwnerId,
          toUserId: input.toUserId,
          details: input.details,
          txHash: input.txHash,
          chainTransferId: input.chainTransferId
        }
      });

      await prisma.batch.update({
        where: { id: batch.id },
        data: { status: BatchStatus.IN_TRANSIT }
      });

      await prisma.traceEvent.create({
        data: {
          batchId: batch.id,
          actorId: req.user!.id,
          eventType: "OWNERSHIP_TRANSFER",
          details: input.details,
          txHash: input.txHash
        }
      });

      await recordTransaction({
        userId: req.user!.id,
        resourceType: "transfer",
        resourceId: transfer.id,
        contractName: "OwnershipTransfer",
        methodName: "transferBatchOwnership",
        txHash: input.txHash,
        chainId: input.chainId,
        status: input.txHash ? TransactionStatus.CONFIRMED : TransactionStatus.PENDING,
        metadataJson: {
          batchId: batch.id,
          toUserId: input.toUserId
        }
      });

      res.status(201).json({ transfer });
    } catch (error) {
      res.status(400).json({ message: "Unable to transfer ownership.", error });
    }
  }
);

batchesRouter.post(
  "/:id/trace-events",
  requireAuth,
  requireApprovedParticipant,
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = traceEventSchema.parse(req.body);
      const event = await prisma.traceEvent.create({
        data: {
          batchId: String(req.params.id),
          actorId: req.user!.id,
          eventType: input.eventType,
          details: input.details,
          metadataUri: input.metadataUri,
          txHash: input.txHash
        }
      });

      await recordTransaction({
        userId: req.user!.id,
        resourceType: "trace-event",
        resourceId: event.id,
        contractName: "Traceability",
        methodName: "recordManualEvent",
        txHash: input.txHash,
        chainId: input.chainId,
        status: input.txHash ? TransactionStatus.CONFIRMED : TransactionStatus.PENDING,
        metadataJson: {
          batchId: String(req.params.id),
          eventType: input.eventType
        }
      });

      res.status(201).json({ event });
    } catch (error) {
      res.status(400).json({ message: "Unable to record traceability event.", error });
    }
  }
);

batchesRouter.get("/:id/traceability", async (req, res) => {
  const batch = await prisma.batch.findUnique({
    where: { id: String(req.params.id) },
    include: {
      farm: true,
      certificates: {
        orderBy: { createdAt: "asc" }
      },
      transfers: {
        orderBy: { createdAt: "asc" },
        include: {
          fromUser: { select: { name: true, role: true } },
          toUser: { select: { name: true, role: true } }
        }
      },
      transformations: {
        orderBy: { createdAt: "asc" },
        include: {
          actor: { select: { name: true, role: true } }
        }
      },
      traceEvents: {
        orderBy: { occurredAt: "asc" },
        include: {
          actor: { select: { name: true, role: true } }
        }
      }
    }
  });

  if (!batch) {
    return res.status(404).json({ message: "Batch not found." });
  }

  res.json({ batch });
});

batchesRouter.post(
  "/:id/qrcode",
  requireAuth,
  requireApprovedParticipant,
  async (req: AuthenticatedRequest, res) => {
    const batch = await prisma.batch.findUnique({ where: { id: String(req.params.id) } });
    if (!batch) {
      return res.status(404).json({ message: "Batch not found." });
    }

    const token = randomUUID();
    const verificationUrl = `${env.NEXT_PUBLIC_APP_URL}/verify?token=${token}`;
    const qrDataUrl = await generateQrDataUrl(verificationUrl);

    const qrRecord = await prisma.qrVerification.upsert({
      where: { batchId: batch.id },
      update: {
        token,
        verificationUrl,
        qrDataUrl
      },
      create: {
        batchId: batch.id,
        token,
        verificationUrl,
        qrDataUrl
      }
    });

    res.json({ qr: qrRecord });
  }
);
