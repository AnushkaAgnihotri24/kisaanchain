import { app } from "./app";
import { env } from "./config/env";
import { bootstrapDatabase } from "./lib/database-bootstrap";

async function main() {
  await bootstrapDatabase();

  app.listen(env.BACKEND_PORT, () => {
    console.log(`KisaanChain backend listening on http://localhost:${env.BACKEND_PORT}`);
  });
}

main().catch((error) => {
  console.error("Failed to start backend:", error);
  process.exit(1);
});
