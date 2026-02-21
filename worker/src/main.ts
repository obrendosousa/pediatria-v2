import http from "node:http";
import { getWorkerConfig } from "./config";
import { startWorkerRuntime } from "./runtime";
import { workerHealthState, markWorkerError } from "./health";
import { getAutomationCheckpointerHealth } from "@/lib/automation/checkpointer";

let shutdownInProgress = false;

async function bootstrap() {
  const config = getWorkerConfig();
  const runtime = await startWorkerRuntime(config);

  const server = http.createServer((req, res) => {
    if (req.url === "/health" && req.method === "GET") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: true,
          service: "langgraph-automation-worker",
          ...workerHealthState,
          workerGraphCheckpointerMode: "memory",
          checkpointer: getAutomationCheckpointerHealth(),
          cronJobs: runtime.getCronJobs(),
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

  const shutdown = async (signal: string, exitCode = 0) => {
    if (shutdownInProgress) return;
    shutdownInProgress = true;
    console.log(`[Worker] ${signal} received, shutting down...`);
    try {
      await runtime.stop();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    } finally {
      process.exit(exitCode);
    }
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT", 0);
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM", 0);
  });
  process.on("unhandledRejection", (reason) => {
    markWorkerError(reason);
    console.error("[Worker] unhandledRejection:", reason);
    void shutdown("unhandledRejection", 1);
  });
  process.on("uncaughtException", (error) => {
    markWorkerError(error);
    console.error("[Worker] uncaughtException:", error);
    void shutdown("uncaughtException", 1);
  });
}

bootstrap().catch((error) => {
  markWorkerError(error);
  console.error("[Worker] fatal boot error:", error);
  process.exit(1);
});
