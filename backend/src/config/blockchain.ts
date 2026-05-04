import deployment from "../generated/deployment.sepolia.json";

export const SEPOLIA_CHAIN_ID = 11155111;

export const blockchainConfig = {
  chainId: SEPOLIA_CHAIN_ID,
  networkName: "sepolia",
  deployment
} as const;
