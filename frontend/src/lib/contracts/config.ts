import deployment from "./deployment.sepolia.json";

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

export const sepoliaNetworkParams = {
  chainId: SEPOLIA_CHAIN_ID_HEX,
  chainName: "Sepolia",
  nativeCurrency: {
    name: "Sepolia Ether",
    symbol: "SEP",
    decimals: 18
  },
  rpcUrls: [process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com"],
  blockExplorerUrls: [process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || "https://sepolia.etherscan.io"]
};

export const contractDeployment = deployment;
