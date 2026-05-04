import { JsonRpcProvider } from "ethers";
import { env } from "../config/env";
import { blockchainConfig } from "../config/blockchain";

export const blockchainDeployment = blockchainConfig.deployment;

let provider: JsonRpcProvider | null = null;

export function getSepoliaProvider() {
  if (!env.SEPOLIA_RPC_URL) {
    throw new Error("SEPOLIA_RPC_URL is required for Sepolia blockchain access.");
  }

  if (!provider) {
    provider = new JsonRpcProvider(env.SEPOLIA_RPC_URL, blockchainConfig.chainId);
  }

  return provider;
}

export function getContractAddress(contractName: string) {
  const contract = (blockchainDeployment.contracts as Record<string, { address: string }>)[contractName];
  return contract?.address || null;
}
