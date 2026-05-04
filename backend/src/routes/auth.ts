import { Router } from "express";
import { ApprovalStatus, Role } from "@prisma/client";
import { z } from "zod";
import { comparePassword, hashPassword, signToken } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { roleRequiresApproval } from "../lib/roles";

function logAuthError(action: "register" | "login" | "link-wallet" | "profile", error: unknown) {
  console.error(`Auth ${action} failed:`, error);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join(" ");
  }

  return fallback;
}

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(Role),
  organization: z.string().optional(),
  location: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const linkWalletSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
});

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  organization: z.string().optional(),
  location: z.string().optional(),
  bio: z.string().optional()
});

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  try {
    const input = registerSchema.parse(req.body);

    if (input.role === Role.ADMIN) {
      return res.status(403).json({ message: "Admin accounts are managed separately." });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const passwordHash = await hashPassword(input.password);
    const approvalStatus = roleRequiresApproval(input.role)
      ? ApprovalStatus.PENDING
      : ApprovalStatus.APPROVED;

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
        role: input.role,
        organization: input.organization,
        location: input.location,
        approvalStatus,
        approvedAt: approvalStatus === ApprovalStatus.APPROVED ? new Date() : null
      }
    });

    const token = signToken({ userId: user.id, role: user.role, email: user.email });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        approvalStatus: user.approvalStatus,
        walletAddress: user.walletAddress
      }
    });
  } catch (error) {
    logAuthError("register", error);
    res.status(400).json({ message: getErrorMessage(error, "Unable to register account.") });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });

    if (!user || !(await comparePassword(input.password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = signToken({ userId: user.id, role: user.role, email: user.email });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        approvalStatus: user.approvalStatus,
        walletAddress: user.walletAddress,
        organization: user.organization,
        location: user.location,
        bio: user.bio
      }
    });
  } catch (error) {
    logAuthError("login", error);
    res.status(400).json({ message: getErrorMessage(error, "Unable to log in.") });
  }
});

authRouter.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      approvalStatus: true,
      walletAddress: true,
      organization: true,
      location: true,
      bio: true,
      isOnChainVerified: true,
      createdAt: true
    }
  });

  res.json({ user });
});

authRouter.post("/link-wallet", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const input = linkWalletSchema.parse(req.body);
    const existingWalletUser = await prisma.user.findUnique({
      where: { walletAddress: input.walletAddress },
      select: { id: true, email: true }
    });

    if (existingWalletUser && existingWalletUser.id !== req.user!.id) {
      return res.status(409).json({
        message: "This MetaMask wallet is already linked to another KisaanChain account."
      });
    }

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        walletAddress: input.walletAddress,
        walletLinkedAt: new Date()
      }
    });

    res.json({
      message: "Wallet linked successfully.",
      user: {
        id: user.id,
        walletAddress: user.walletAddress
      }
    });
  } catch (error) {
    logAuthError("link-wallet", error);
    res.status(400).json({ message: getErrorMessage(error, "Unable to link wallet.") });
  }
});

authRouter.patch("/profile", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const input = updateProfileSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: input
    });

    res.json({ user });
  } catch (error) {
    logAuthError("profile", error);
    res.status(400).json({ message: getErrorMessage(error, "Unable to update profile.") });
  }
});
