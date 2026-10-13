/**
 * Cloudflare Workers entry point: the only file that knows which adapter is in use.
 *
 * @module
 */

import { toWorker } from "./adapters/cloudflare/mod.ts";
import { createApp } from "./app/app.ts";
import { consoleSink, createLogger } from "./http/logger.ts";

export default toWorker(
  () => {
    const logger = createLogger(consoleSink);
    return createApp({
      logSink: consoleSink,
      // No mail transport is configured yet: log receipt without the message body or
      // address (OWASP: keep personal data out of logs). Replace with a real sink.
      contactSink: (msg) => {
        logger.log("info", "contact received", {
          receivedAt: msg.receivedAt,
          length: msg.message.length,
        });
        return Promise.resolve();
      },
    });
  },
  { assetsBinding: "ASSETS" },
);
