import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../.env")
];

for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
    break;
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  BACKEND_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().optional(),
  POSTGRES_HOST: z.string().default("127.0.0.1"),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_DB: z.string().default("kisaanchain"),
  POSTGRES_USER: z.string().default("postgres"),
  POSTGRES_PASSWORD: z.string().default("postgres"),
  EMBEDDED_POSTGRES_DIR: z.string().default(".local/postgres"),
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default("7d"),
  ADMIN_EMAIL: z.string().email().default("admin@kisaanchain.local"),
  ADMIN_PASSWORD: z.string().min(8).default("ChangeMe123!"),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  CONSUMER_APP_ORIGIN: z.string().url().default("http://localhost:3000"),
  LOCAL_IPFS_DIR: z.string().default("backend/storage/ipfs"),
  UPLOADS_DIR: z.string().default("backend/storage/uploads"),
  SEPOLIA_RPC_URL: z.preprocess((value) => (value === "" ? undefined : value), z.string().url().optional())
});

const parsedEnv = envSchema.parse(process.env);

const cwd = process.cwd();
const repoRoot =
  fs.existsSync(path.resolve(cwd, "backend")) && fs.existsSync(path.resolve(cwd, "frontend"))
    ? cwd
    : path.resolve(cwd, "..");
const databaseUrl =
  parsedEnv.DATABASE_URL ||
  `postgresql://${encodeURIComponent(parsedEnv.POSTGRES_USER)}:${encodeURIComponent(parsedEnv.POSTGRES_PASSWORD)}@${parsedEnv.POSTGRES_HOST}:${parsedEnv.POSTGRES_PORT}/${parsedEnv.POSTGRES_DB}`;

process.env.DATABASE_URL = databaseUrl;

export const env = {
  ...parsedEnv,
  DATABASE_URL: databaseUrl,
  repoRoot,
  localIpfsDir: path.resolve(repoRoot, parsedEnv.LOCAL_IPFS_DIR),
  uploadsDir: path.resolve(repoRoot, parsedEnv.UPLOADS_DIR),
  embeddedPostgresDir: path.resolve(repoRoot, parsedEnv.EMBEDDED_POSTGRES_DIR)
};
