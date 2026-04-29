import { NextFunction, Request, Response } from "express";
import { ApprovalStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { verifyToken } from "../lib/auth";

export type RequestUser = {
  id: string;
  email: string;
  role: Role;
  approvalStatus: ApprovalStatus;
  walletAddress: string | null;
};

export type AuthenticatedRequest = Request & {
  user?: RequestUser;
};

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authorization token is required." });
  }

  try {
    const token = authorization.replace("Bearer ", "");
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        approvalStatus: true,
        walletAddress: true
      }
    });

    if (!user) {
      return res.status(401).json({ message: "User not found." });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

export function requireRoles(...roles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required." });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have access to this action." });
    }

    next();
  };
}

export function requireApprovedParticipant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  if (req.user.approvalStatus !== ApprovalStatus.APPROVED) {
    return res.status(403).json({ message: "Participant approval is required for this action." });
  }

  next();
}
