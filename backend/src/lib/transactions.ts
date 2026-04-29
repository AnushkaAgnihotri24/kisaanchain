import { Prisma, TransactionStatus } from "@prisma/client";
import { prisma } from "./prisma";

type RecordTransactionInput = {
  userId?: string;
  resourceType: string;
  resourceId?: string;
  contractName: string;
  methodName: string;
  txHash?: string;
  chainId?: number;
  status?: TransactionStatus;
  metadataJson?: Prisma.InputJsonValue;
};

export async function recordTransaction(input: RecordTransactionInput) {
  if (!input.txHash) {
    return null;
  }

  return prisma.blockchainTransaction.upsert({
    where: { txHash: input.txHash },
    update: {
      status: input.status ?? TransactionStatus.PENDING,
      metadataJson: input.metadataJson
    },
    create: {
      userId: input.userId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      contractName: input.contractName,
      methodName: input.methodName,
      txHash: input.txHash,
      chainId: input.chainId ?? 31337,
      status: input.status ?? TransactionStatus.PENDING,
      metadataJson: input.metadataJson
    }
  });
}
