"use client";

import { BrowserProvider, Contract, parseEther } from "ethers";
import deployment from "./contracts/deployment.local.json";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

export const roleToContractEnum = {
  FARMER: 1,
  ADMIN: 2,
  BUYER: 3,
  CONSUMER: 4,
  CERTIFIER: 5
} as const;

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask or a compatible wallet is required.");
  }

  await window.ethereum.request({ method: "eth_requestAccounts" });
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  return {
    provider,
    signer,
    address: await signer.getAddress(),
    chainId: Number((await provider.getNetwork()).chainId)
  };
}

export function getDeployment() {
  return deployment;
}

export async function getContract(name: string) {
  const wallet = await connectWallet();
  const contracts = deployment.contracts as Record<string, { address: string; abi: unknown }>;
  const contract = contracts[name];

  if (!contract?.address) {
    throw new Error(`${name} is not deployed yet. Run the Hardhat deploy script first.`);
  }

  return {
    wallet,
    contract: new Contract(contract.address, contract.abi as any, wallet.signer)
  };
}

export async function writeContract(
  name: string,
  method: string,
  args: unknown[] = [],
  valueInEth?: string
) {
  const { wallet, contract } = await getContract(name);
  const transaction = valueInEth
    ? await contract[method](...args, { value: parseEther(valueInEth) })
    : await contract[method](...args);
  const receipt = await transaction.wait();

  return {
    txHash: transaction.hash as string,
    chainId: wallet.chainId,
    receipt,
    contract
  };
}

export function findEventArgs(
  receipt: Awaited<ReturnType<typeof writeContract>>["receipt"],
  contract: Awaited<ReturnType<typeof getContract>>["contract"],
  eventName: string
) {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === eventName) {
        return parsed.args;
      }
    } catch {
      continue;
    }
  }

  return null;
}
