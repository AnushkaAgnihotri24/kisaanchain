import { Role } from "@prisma/client";

export const roleToContractEnum: Record<Role, number> = {
  ADMIN: 2,
  FARMER: 1,
  BUYER: 3,
  CONSUMER: 4,
  CERTIFIER: 5
};

export function roleRequiresApproval(role: Role) {
  return role !== Role.CONSUMER;
}
