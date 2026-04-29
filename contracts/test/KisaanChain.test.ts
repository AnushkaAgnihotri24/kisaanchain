import { expect } from "chai";
import { ethers } from "hardhat";

describe("KisaanChain", function () {
  async function deployFixture() {
    const [admin, farmer, buyer, certifier] = await ethers.getSigners();

    const participantRegistry = await (
      await ethers.getContractFactory("ParticipantRegistry")
    ).deploy(admin.address);
    await participantRegistry.waitForDeployment();

    const traceability = await (
      await ethers.getContractFactory("Traceability")
    ).deploy(await participantRegistry.getAddress(), admin.address);
    await traceability.waitForDeployment();

    const farmRegistration = await (
      await ethers.getContractFactory("FarmRegistration")
    ).deploy(await participantRegistry.getAddress(), admin.address);
    await farmRegistration.waitForDeployment();

    const ownershipTransfer = await (
      await ethers.getContractFactory("OwnershipTransfer")
    ).deploy(await participantRegistry.getAddress(), admin.address);
    await ownershipTransfer.waitForDeployment();

    const batchCreation = await (
      await ethers.getContractFactory("BatchCreation")
    ).deploy(await participantRegistry.getAddress(), await farmRegistration.getAddress(), admin.address);
    await batchCreation.waitForDeployment();

    const batchTransformation = await (
      await ethers.getContractFactory("BatchTransformation")
    ).deploy(
      await batchCreation.getAddress(),
      await ownershipTransfer.getAddress(),
      await traceability.getAddress(),
      await participantRegistry.getAddress(),
      admin.address
    );
    await batchTransformation.waitForDeployment();

    const certificateVerification = await (
      await ethers.getContractFactory("CertificateVerification")
    ).deploy(
      await batchCreation.getAddress(),
      await participantRegistry.getAddress(),
      await traceability.getAddress(),
      admin.address
    );
    await certificateVerification.waitForDeployment();

    const buyerEnforcement = await (
      await ethers.getContractFactory("BuyerEnforcement")
    ).deploy(await participantRegistry.getAddress(), admin.address);
    await buyerEnforcement.waitForDeployment();

    const paymentEscrow = await (
      await ethers.getContractFactory("PaymentEscrow")
    ).deploy(
      await ownershipTransfer.getAddress(),
      await buyerEnforcement.getAddress(),
      await batchCreation.getAddress(),
      await traceability.getAddress(),
      await participantRegistry.getAddress(),
      admin.address
    );
    await paymentEscrow.waitForDeployment();

    await (await ownershipTransfer.setTraceability(await traceability.getAddress())).wait();
    await (await ownershipTransfer.grantModule(await batchCreation.getAddress())).wait();
    await (
      await batchCreation.setLinkedContracts(await traceability.getAddress(), await ownershipTransfer.getAddress())
    ).wait();
    await (await traceability.grantRecorder(await batchCreation.getAddress())).wait();
    await (await traceability.grantRecorder(await batchTransformation.getAddress())).wait();
    await (await traceability.grantRecorder(await ownershipTransfer.getAddress())).wait();
    await (await traceability.grantRecorder(await certificateVerification.getAddress())).wait();
    await (await traceability.grantRecorder(await paymentEscrow.getAddress())).wait();
    await (await buyerEnforcement.grantEscrowRole(await paymentEscrow.getAddress())).wait();

    return {
      admin,
      farmer,
      buyer,
      certifier,
      participantRegistry,
      traceability,
      farmRegistration,
      ownershipTransfer,
      batchCreation,
      batchTransformation,
      certificateVerification,
      buyerEnforcement,
      paymentEscrow
    };
  }

  it("supports the saffron lifecycle from participant approval to escrow release", async function () {
    const {
      admin,
      farmer,
      buyer,
      certifier,
      participantRegistry,
      traceability,
      farmRegistration,
      ownershipTransfer,
      batchCreation,
      batchTransformation,
      certificateVerification,
      buyerEnforcement,
      paymentEscrow
    } = await deployFixture();

    await participantRegistry
      .connect(farmer)
      .requestRegistration(1, "Farmer One", "farmer@example.com", "ipfs://farmer");
    await participantRegistry
      .connect(buyer)
      .requestRegistration(3, "Buyer One", "buyer@example.com", "ipfs://buyer");
    await participantRegistry
      .connect(certifier)
      .requestRegistration(5, "Certifier One", "cert@example.com", "ipfs://certifier");

    await participantRegistry.connect(admin).verifyParticipant(farmer.address, true, "approved");
    await participantRegistry.connect(admin).verifyParticipant(buyer.address, true, "approved");
    await participantRegistry.connect(admin).verifyParticipant(certifier.address, true, "approved");

    await buyerEnforcement
      .connect(admin)
      .setBuyerRule(buyer.address, true, true, 3, "Buyer meets compliance rules");

    await farmRegistration
      .connect(farmer)
      .registerFarm("Pampore Reserve", "Kashmir", "Saffron", "33.77,74.93", 12, "ipfs://farm");

    await batchCreation
      .connect(farmer)
      .createBatch("SAF-2026-001", 1, 1714176000, 500, "grams", "ipfs://batch");

    await certificateVerification
      .connect(certifier)
      .addCertificate(1, "GI Tag", "cid-cert-1", "ipfs://certificate");
    await certificateVerification.connect(certifier).verifyCertificate(1, 0);

    await batchTransformation
      .connect(farmer)
      .recordTransformation(1, "PACKAGING", "Premium packaging completed", "ipfs://packaging");

    await paymentEscrow
      .connect(buyer)
      .createEscrow(1, farmer.address, "Release after delivery and ownership confirmation", {
        value: ethers.parseEther("1")
      });

    await ownershipTransfer
      .connect(farmer)
      .transferBatchOwnership(1, buyer.address, "Transferred to buyer after purchase");

    await paymentEscrow.connect(buyer).confirmDelivery(1);

    const beforeBalance = await ethers.provider.getBalance(farmer.address);
    await paymentEscrow.connect(buyer).releaseEscrow(1);
    const afterBalance = await ethers.provider.getBalance(farmer.address);

    expect(afterBalance).to.be.greaterThan(beforeBalance);
    expect(await ownershipTransfer.ownerOfBatch(1)).to.equal(buyer.address);
    expect(await certificateVerification.getVerifiedCertificateCount(1)).to.equal(1);
    expect(await traceability.getEventCount(1)).to.be.greaterThanOrEqual(6);
  });
});
