import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { ensureAdminUser } from "../src/lib/admin-seed";

dotenv.config({ path: "../.env" });

const prisma = new PrismaClient();

async function main() {
  await ensureAdminUser(prisma);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
