import { Router } from "express";
import { prisma } from "../lib/prisma";

export const verifyRouter = Router();

verifyRouter.get("/", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : undefined;
  const batchCode = typeof req.query.batchCode === "string" ? req.query.batchCode : undefined;
  const batchId = typeof req.query.batchId === "string" ? req.query.batchId : undefined;
  const identifierFilters = [batchId ? { id: batchId } : null, batchCode ? { batchCode } : null].filter(
    Boolean
  );

  if (!token && identifierFilters.length === 0) {
    return res.status(400).json({
      verified: false,
      message: "Provide a QR token, batch ID, or batch code to verify a product."
    });
  }

  let batch =
    token
      ? await prisma.batch.findFirst({
          where: {
            qrVerification: {
              token
            }
          },
          include: {
            qrVerification: true,
            farm: {
              include: {
                owner: {
                  select: {
                    name: true,
                    walletAddress: true
                  }
                }
              }
            },
            certificates: {
              include: {
                issuer: {
                  select: {
                    name: true
                  }
                },
                verifier: {
                  select: {
                    name: true
                  }
                }
              },
              orderBy: { createdAt: "asc" }
            },
            transformations: {
              include: {
                actor: {
                  select: {
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
                    name: true,
                    role: true
                  }
                },
                toUser: {
                  select: {
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
                    name: true,
                    role: true
                  }
                }
              },
              orderBy: { occurredAt: "asc" }
            }
          }
        })
      : await prisma.batch.findFirst({
          where: {
            OR: identifierFilters as { id?: string; batchCode?: string }[]
          },
          include: {
            qrVerification: true,
            farm: {
              include: {
                owner: {
                  select: {
                    name: true,
                    walletAddress: true
                  }
                }
              }
            },
            certificates: {
              include: {
                issuer: {
                  select: {
                    name: true
                  }
                },
                verifier: {
                  select: {
                    name: true
                  }
                }
              },
              orderBy: { createdAt: "asc" }
            },
            transformations: {
              include: {
                actor: {
                  select: {
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
                    name: true,
                    role: true
                  }
                },
                toUser: {
                  select: {
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
                    name: true,
                    role: true
                  }
                }
              },
              orderBy: { occurredAt: "asc" }
            }
          }
        });

  if (!batch) {
    return res.status(404).json({
      verified: false,
      message: "No batch was found for the provided verification input."
    });
  }

  if (batch.qrVerification) {
    await prisma.qrVerification.update({
      where: { id: batch.qrVerification.id },
      data: { lastVerifiedAt: new Date() }
    });
  }

  const latestTransfer = batch.transfers[batch.transfers.length - 1];
  const currentOwner = latestTransfer?.toUser ?? batch.farm.owner;
  const verifiedCertificates = batch.certificates.filter(
    (certificate: { isVerified: boolean }) => certificate.isVerified
  );

  res.json({
    verified: verifiedCertificates.length > 0,
    authenticityStatus: verifiedCertificates.length > 0 ? "Verified" : "Pending verification",
    batch,
    currentOwner,
    summary: {
      originFarm: batch.farm.farmName,
      location: batch.farm.location,
      chainOfCustodySteps: batch.transfers.length,
      traceEvents: batch.traceEvents.length,
      verifiedCertificates: verifiedCertificates.length
    }
  });
});
