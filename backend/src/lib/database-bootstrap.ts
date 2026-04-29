import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { prisma } from "./prisma";
import { ensureAdminUser } from "./admin-seed";

const execAsync = promisify(exec);

async function runPrismaDbPush() {
  const backendDir = fs.existsSync(path.resolve(process.cwd(), "prisma"))
    ? process.cwd()
    : path.resolve(process.cwd(), "backend");

  let lastError: unknown;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      await execAsync("npm run db:push -- --skip-generate", {
        cwd: backendDir,
        env: process.env
      });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unable to sync Prisma schema to PostgreSQL.");
}

export async function bootstrapDatabase() {
  await runPrismaDbPush();
  await prisma.$connect();
  await ensureAdminUser(prisma);
}
