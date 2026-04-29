import path from "node:path";
import fs from "node:fs";
import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { resolveStoredDocumentPath, storeIpfsLikeFile } from "../lib/ipfs";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";

const upload = multer({ storage: multer.memoryStorage() });

export const uploadsRouter = Router();

uploadsRouter.post("/document", requireAuth, upload.single("file"), async (req: AuthenticatedRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "A document file is required." });
  }

  const extension = path.extname(req.file.originalname) || ".bin";
  const storedFile = storeIpfsLikeFile(req.file.buffer, extension);

  const document = await prisma.storedDocument.upsert({
    where: { cid: storedFile.cid },
    update: {},
    create: {
      cid: storedFile.cid,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      byteSize: req.file.size,
      relativePath: storedFile.relativePath,
      uploadedById: req.user?.id
    }
  });

  res.status(201).json({
    cid: document.cid,
    uri: `ipfs://${document.cid}`,
    document
  });
});

uploadsRouter.get("/documents/:cid", async (req, res) => {
  const document = await prisma.storedDocument.findUnique({
    where: { cid: req.params.cid }
  });

  if (!document) {
    return res.status(404).json({ message: "Document not found." });
  }

  const absolutePath = resolveStoredDocumentPath(document.relativePath);
  if (!fs.existsSync(absolutePath)) {
    return res.status(404).json({ message: "Stored document file is missing." });
  }

  res.setHeader("Content-Type", document.mimeType);
  fs.createReadStream(absolutePath).pipe(res);
});
