// Node entry point for hosts that run a plain Node process (e.g. Render), as opposed to
// Cloudflare Workers. Built by `vite build --config vite.config.render.ts`, which disables
// the Cloudflare plugin so the SSR bundle stays a portable Web-standard fetch handler.
import { serve } from "srvx/node";
import { serveStatic } from "srvx/static";

const appModule = await import("./dist/server/server.js");
const app = appModule.default;

const port = Number(process.env.PORT) || 3000;

serve({
  fetch: (request) => app.fetch(request, undefined, undefined),
  middleware: [serveStatic({ dir: "./dist/client" })],
  port,
  hostname: "0.0.0.0",
});

console.log(`SRMS frontend listening on port ${port}`);
