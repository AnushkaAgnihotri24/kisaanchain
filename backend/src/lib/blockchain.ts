import deployment from "../generated/deployment.local.json";

export const blockchainDeployment = deployment;

export function getContractAddress(contractName: string) {
  const contract = (blockchainDeployment.contracts as Record<string, { address: string }>)[contractName];
  return contract?.address || null;
}
