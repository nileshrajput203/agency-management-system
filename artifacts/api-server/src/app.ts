import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import { rateLimit } from "express-rate-limit";
import router from "./routes";
import v1Router from "./routes/v1";
import { logger, accessLogger } from "./lib/logger";
import publicRouter from "./routes/publicCalendar";
import { errorHandler } from "./middleware/errorHandler";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  pinoHttp({
    logger: accessLogger,
    autoLogging: {
      ignore: (req) => {
        const url = req.url || "";
        return (
          url.startsWith("/api/uploads") ||
          url.startsWith("/api/v1/uploads") ||
          url.startsWith("/public") ||
          url.startsWith("/health") ||
          url === "/healthz" ||
          url === "/favicon.ico"
        );
      },
    },
    customProps: (req: any) => {
      return {
        userId: req.userId || req.user?.id || undefined,
        ip: req.ip || req.headers["x-forwarded-for"] || undefined,
      };
    },
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

// Unrestricted Health Checks for Orchestrators & Monitoring
app.get(["/healthz", "/health", "/api/health", "/api/healthz", "/api/v1/health", "/api/v1/healthz"], (_req, res) => {
  res.json({ status: "ok" });
});
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    if (
      process.env.NODE_ENV !== "production" ||
      origin.includes("localhost") ||
      origin.includes("127.0.0.1") ||
      origin.includes("run.app")
    ) {
      return callback(null, true);
    }
    if (allowedOrigins.length === 0) {
      return callback(null, true);
    }
    return callback(new Error("CORS policy error: Origin not allowed"), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use(["/api/uploads", "/api/v1/uploads"], express.static(uploadsDir));

const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10);

const authLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || "25", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication requests, please try again later." },
  validate: { trustProxy: false },
});

const apiLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "2000", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many API requests, please try again later." },
  validate: { trustProxy: false },
});

const publicLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: parseInt(process.env.PUBLIC_RATE_LIMIT_MAX || "300", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many public requests, please try again later." },
  validate: { trustProxy: false },
});

app.use("/public", publicLimiter, publicRouter);
app.use(["/api/auth", "/api/v1/auth"], authLimiter);
app.use("/api/v1", apiLimiter, v1Router);
app.use("/api", apiLimiter, router);

const getPublicDir = () => {
  const possiblePaths = [
    path.resolve(process.cwd(), "dist/public"),
    path.resolve(__dirname, "public"),
    path.resolve(__dirname, "dist/public"),
    path.resolve(__dirname, "../../agency-os/dist/public"),
    path.resolve(process.cwd(), "artifacts/agency-os/dist/public"),
  ];
  return possiblePaths.find((p) => fs.existsSync(p));
};

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  const dir = getPublicDir();
  if (dir) {
    return express.static(dir)(req, res, next);
  }
  next();
});

app.use("/public", (req, res, next) => {
  const dir = getPublicDir();
  if (dir) {
    return express.static(dir)(req, res, next);
  }
  next();
});

app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  if (req.path.startsWith("/api") || req.path.startsWith("/public/calendar")) {
    return next();
  }
  const dir = getPublicDir();
  if (dir) {
    const indexPath = path.resolve(dir, "index.html");
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  next();
});

app.use(errorHandler);

export default app;
