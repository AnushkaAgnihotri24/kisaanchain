import { artifacts, ethers, network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

async function main() {
  if (network.name !== "sepolia") {
    throw new Error("KisaanChain deployment is configured for Sepolia. Run deploy:sepolia.");
  }

  if (!process.env.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY is required to deploy KisaanChain contracts to Sepolia.");
  }

  const [deployer] = await ethers.getSigners();

  const participantRegistryFactory = await ethers.getContractFactory("ParticipantRegistry");
  const participantRegistry = await participantRegistryFactory.deploy(deployer.address);
  await participantRegistry.waitForDeployment();

  const traceabilityFactory = await ethers.getContractFactory("Traceability");
  const traceability = await traceabilityFactory.deploy(await participantRegistry.getAddress(), deployer.address);
  await traceability.waitForDeployment();

  const farmRegistrationFactory = await ethers.getContractFactory("FarmRegistration");
  const farmRegistration = await farmRegistrationFactory.deploy(
    await participantRegistry.getAddress(),
    deployer.address
  );
  await farmRegistration.waitForDeployment();

  const ownershipTransferFactory = await ethers.getContractFactory("OwnershipTransfer");
  const ownershipTransfer = await ownershipTransferFactory.deploy(
    await participantRegistry.getAddress(),
    deployer.address
  );
  await ownershipTransfer.waitForDeployment();

  const batchCreationFactory = await ethers.getContractFactory("BatchCreation");
  const batchCreation = await batchCreationFactory.deploy(
    await participantRegistry.getAddress(),
    await farmRegistration.getAddress(),
    deployer.address
  );
  await batchCreation.waitForDeployment();

  const batchTransformationFactory = await ethers.getContractFactory("BatchTransformation");
  const batchTransformation = await batchTransformationFactory.deploy(
    await batchCreation.getAddress(),
    await ownershipTransfer.getAddress(),
    await traceability.getAddress(),
    await participantRegistry.getAddress(),
    deployer.address
  );
  await batchTransformation.waitForDeployment();

  const certificateVerificationFactory = await ethers.getContractFactory("CertificateVerification");
  const certificateVerification = await certificateVerificationFactory.deploy(
    await batchCreation.getAddress(),
    await participantRegistry.getAddress(),
    await traceability.getAddress(),
    deployer.address
  );
  await certificateVerification.waitForDeployment();

  const buyerEnforcementFactory = await ethers.getContractFactory("BuyerEnforcement");
  const buyerEnforcement = await buyerEnforcementFactory.deploy(
    await participantRegistry.getAddress(),
    deployer.address
  );
  await buyerEnforcement.waitForDeployment();

  const paymentEscrowFactory = await ethers.getContractFactory("PaymentEscrow");
  const paymentEscrow = await paymentEscrowFactory.deploy(
    await ownershipTransfer.getAddress(),
    await buyerEnforcement.getAddress(),
    await batchCreation.getAddress(),
    await traceability.getAddress(),
    await participantRegistry.getAddress(),
    deployer.address
  );
  await paymentEscrow.waitForDeployment();

  const consumerTransparencyFactory = await ethers.getContractFactory("ConsumerTransparency");
  const consumerTransparency = await consumerTransparencyFactory.deploy(
    await batchCreation.getAddress(),
    await farmRegistration.getAddress(),
    await ownershipTransfer.getAddress(),
    await certificateVerification.getAddress(),
    await traceability.getAddress()
  );
  await consumerTransparency.waitForDeployment();

  await (await ownershipTransfer.setTraceability(await traceability.getAddress())).wait();
  await (await ownershipTransfer.grantModule(await batchCreation.getAddress())).wait();
  await (
    await batchCreation.setLinkedContracts(await traceability.getAddress(), await ownershipTransfer.getAddress())
  ).wait();

  for (const recorder of [
    await batchCreation.getAddress(),
    await batchTransformation.getAddress(),
    await ownershipTransfer.getAddress(),
    await certificateVerification.getAddress(),
    await paymentEscrow.getAddress()
  ]) {
    await (await traceability.grantRecorder(recorder)).wait();
  }

  await (await buyerEnforcement.grantEscrowRole(await paymentEscrow.getAddress())).wait();

  const deployment = {
    network: network.name,
    chainId: Number(network.config.chainId ?? 11155111),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {} as Record<string, { address: string; abi: unknown }>
  };

  const contracts = {
    ParticipantRegistry: participantRegistry,
    Traceability: traceability,
    FarmRegistration: farmRegistration,
    OwnershipTransfer: ownershipTransfer,
    BatchCreation: batchCreation,
    BatchTransformation: batchTransformation,
    CertificateVerification: certificateVerification,
    BuyerEnforcement: buyerEnforcement,
    PaymentEscrow: paymentEscrow,
    ConsumerTransparency: consumerTransparency
  };

  for (const [name, contract] of Object.entries(contracts)) {
    const artifact = await artifacts.readArtifact(name);
    deployment.contracts[name] = {
      address: await contract.getAddress(),
      abi: artifact.abi
    };
  }

  const targets = [
    path.resolve(__dirname, "..", "deployments", `${deployment.chainId}.json`),
    path.resolve(__dirname, "..", "..", "frontend", "src", "lib", "contracts", "deployment.sepolia.json"),
    path.resolve(__dirname, "..", "..", "backend", "src", "generated", "deployment.sepolia.json")
  ];

  for (const target of targets) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(deployment, null, 2));
  }

  console.log("KisaanChain contracts deployed:");
  for (const [name, value] of Object.entries(deployment.contracts)) {
    console.log(`${name}: ${value.address}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
