import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env";

export type StoredIpfsDocument = {
  cid: string;
  relativePath: string;
  absolutePath: string;
};

function ensureDirectory(directory: string) {
  fs.mkdirSync(directory, { recursive: true });
}

export function storeIpfsLikeFile(buffer: Buffer, extension: string) {
  ensureDirectory(env.localIpfsDir);

  const digest = crypto.createHash("sha256").update(buffer).digest("hex");
  const cid = `bafy${digest.slice(0, 44)}`;
  const filename = `${cid}${extension}`;
  const absolutePath = path.join(env.localIpfsDir, filename);
  const relativePath = path.relative(env.repoRoot, absolutePath).replace(/\\/g, "/");

  if (!fs.existsSync(absolutePath)) {
    fs.writeFileSync(absolutePath, buffer);
  }

  return {
    cid,
    relativePath,
    absolutePath
  } satisfies StoredIpfsDocument;
}

export function resolveStoredDocumentPath(relativePath: string) {
  return path.resolve(env.repoRoot, relativePath);
}
