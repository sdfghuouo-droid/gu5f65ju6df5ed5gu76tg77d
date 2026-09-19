import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import authRouter from "./routes/auth";
import { requireAuth } from "./lib/auth";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser clients (PowerShell agents, curl) and any origin in CORS_ORIGINS.
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  }),
);

app.use(cookieParser(process.env.COOKIE_SECRET ?? "clouddesk-cookie-secret"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Open routes: auth + agent-facing endpoints (token-auth, no session needed)
app.use("/api/auth", authRouter);

const PUBLIC_PATHS = new Set([
  "/healthz",
  "/clients/register",
  "/agents/heartbeat",
  "/agents/command-result",
]);

app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  const path = req.path;
  if (PUBLIC_PATHS.has(path)) {
    next();
    return;
  }
  requireAuth(req, res, next);
});

app.use("/api", router);

export default app;