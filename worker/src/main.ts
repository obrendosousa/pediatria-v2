import http from "node:http";
import { getWorkerConfig } from "./config";
import { startWorkerRuntime } from "./runtime";
import { workerHealthState, markWorkerError } from "./health";

async function bootstrap() {
  const config = getWorkerConfig();
  const stopRuntime = await startWorkerRuntime(config);

  const server = http.createServer((req, res) => {
    if (req.url === "/health" && req.method === "GET") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: true,
          service: "langgraph-automation-worker",
          ...workerHealthState,
        })
      );
      return;
    }

    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
  });

  server.listen(config.port, () => {
    console.log(`[Worker] online at :${config.port}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[Worker] ${signal} received, shutting down...`);
    await stopRuntime();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

bootstrap().catch((error) => {
  markWorkerError(error);
  console.error("[Worker] fatal boot error:", error);
  process.exit(1);
});
