import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { authRouter } from "./routes/auth";
import { participantsRouter } from "./routes/participants";
import { farmsRouter } from "./routes/farms";
import { batchesRouter } from "./routes/batches";
import { ordersRouter } from "./routes/orders";
import { verifyRouter } from "./routes/verify";
import { uploadsRouter } from "./routes/uploads";
import { transactionsRouter } from "./routes/transactions";
import { blockchainDeployment } from "./lib/blockchain";
import { verifyPostgresConnection } from "./lib/postgres";

export const app = express();

app.use(
  cors({
    origin: [env.CONSUMER_APP_ORIGIN, env.NEXT_PUBLIC_APP_URL],
    credentials: true
  })
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "8mb" }));

app.get("/api/health", async (_req, res) => {
  try {
    const dbResult = await verifyPostgresConnection();

    res.json({
      status: "ok",
      database: {
        connected: true,
        name: dbResult.rows[0]?.current_database,
        user: dbResult.rows[0]?.current_user
      },
      deployment: blockchainDeployment
    });
  } catch (error) {
    res.status(503).json({
      status: "degraded",
      database: {
        connected: false
      },
      message: error instanceof Error ? error.message : "Database unavailable.",
      deployment: blockchainDeployment
    });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/participants", participantsRouter);
app.use("/api/farms", farmsRouter);
app.use("/api/batches", batchesRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/verify", verifyRouter);
app.use("/api/upload", uploadsRouter);
app.use("/api/transactions", transactionsRouter);

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({
    message: error.message || "Unexpected server error."
  });
});
