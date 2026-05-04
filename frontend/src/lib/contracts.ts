"use client";

import { BrowserProvider, Contract, parseEther } from "ethers";
import {
  contractDeployment,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_CHAIN_ID_HEX,
  sepoliaNetworkParams
} from "./contracts/config";

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

type EthereumProvider = {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      isMetaMask?: boolean;
      providers?: EthereumProvider[];
};

type WalletRpcError = Error & {
  code?: number;
};

export const roleToContractEnum = {
  FARMER: 1,
  ADMIN: 2,
  BUYER: 3,
  CONSUMER: 4,
  CERTIFIER: 5
} as const;

function getMetaMaskProvider() {
  if (!window.ethereum) {
    return null;
  }

  if (window.ethereum.providers?.length) {
    return window.ethereum.providers.find((provider) => provider.isMetaMask) || null;
  }

  return window.ethereum.isMetaMask ? window.ethereum : null;
}

export async function connectWallet() {
  const ethereum = getMetaMaskProvider();

  if (!ethereum) {
    throw new Error("MetaMask is required. Install MetaMask or enable the MetaMask browser extension.");
  }

  try {
    try {
      await ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }]
      });
    } catch (error) {
      if ((error as WalletRpcError).code !== -32601) {
        throw error;
      }
    }

    await ethereum.request({ method: "eth_requestAccounts" });
  } catch (error) {
    if ((error as WalletRpcError).code === 4001) {
      throw new Error("Wallet connection was rejected.");
    }

    throw new Error(error instanceof Error ? error.message : "Unable to connect wallet.");
  }

  await ensureSepoliaNetwork(ethereum);
  const provider = new BrowserProvider(ethereum as any);
  const signer = await provider.getSigner();
  return {
    provider,
    signer,
    address: await signer.getAddress(),
    chainId: Number((await provider.getNetwork()).chainId)
  };
}

async function ensureSepoliaNetwork(ethereum: EthereumProvider) {
  const currentChainId = await ethereum.request({ method: "eth_chainId" });
  if (String(currentChainId).toLowerCase() === SEPOLIA_CHAIN_ID_HEX) {
    return;
  }

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }]
    });
  } catch (error) {
    const rpcError = error as WalletRpcError;

    if (rpcError.code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [sepoliaNetworkParams]
      });
      return;
    }

    if (rpcError.code === 4001) {
      throw new Error("Please switch MetaMask to Sepolia to continue.");
    }

    throw new Error(error instanceof Error ? error.message : "Unable to switch MetaMask to Sepolia.");
  }
}

export function getDeployment() {
  return contractDeployment;
}

export async function getContract(name: string) {
  const wallet = await connectWallet();
  const contracts = contractDeployment.contracts as Record<string, { address: string; abi: unknown }>;
  const contract = contracts[name];

  if (!contract?.address) {
    throw new Error(`${name} is not deployed on Sepolia yet. Deploy the contracts and update the Sepolia deployment config.`);
  }

  if (wallet.chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error("MetaMask must be connected to Sepolia.");
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
