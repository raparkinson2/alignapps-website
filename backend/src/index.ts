import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import "./env";
import { authRouter } from "./routes/auth";
import { notificationsRouter } from "./routes/notifications";
import { paymentsRouter } from "./routes/payments";
import { connectRouter } from "./routes/connect";
import { filesRouter } from "./routes/files";
import { paymentRemindersRouter, startPaymentReminderScheduler } from "./routes/payment-reminders";
import { weatherRouter } from "./routes/weather";
import { logger } from "hono/logger";
import { authRateLimit, paymentRateLimit, notificationRateLimit, generalRateLimit, weatherRateLimit } from "./middleware/rate-limit";

const app = new Hono();

// Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
app.use("*", secureHeaders());

// Body size limit — reject payloads larger than 1 MB for all routes
// (Stripe webhook is excluded because Hono reads the raw body before this runs)
const MAX_BODY_BYTES = 1 * 1024 * 1024; // 1 MB
app.use("*", async (c, next) => {
  const contentLength = c.req.header("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return c.json({ error: "Request body too large" }, 413);
  }
  return next();
});

// CORS middleware - validates origin against allowlist
// Native mobile apps (iOS/Android) send no Origin header — always allow those requests.
const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.dev\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.netlify\.app$/,
  /^https:\/\/alignapps\.com$/,
  /^https:\/\/www\.alignapps\.com$/,
];

app.use(
  "*",
  cors({
    origin: (origin) => {
      // No origin = native mobile app (React Native fetch doesn't set Origin)
      if (!origin) return "*";
      return allowed.some((re) => re.test(origin)) ? origin : null;
    },
    credentials: true,
  })
);

// Logging
app.use("*", logger());

// Health check endpoint
app.get("/health", (c) => c.json({ status: "ok" }));

// Routes
app.use("/api/auth/*", authRateLimit);
app.route("/api/auth", authRouter);
app.use("/api/notifications/*", notificationRateLimit);
app.route("/api/notifications", notificationsRouter);
app.use("/api/payments/connect/*", generalRateLimit);
app.use("/api/payments/*", paymentRateLimit);
app.route("/api/payments", paymentsRouter);
app.route("/api/payments/connect", connectRouter);
app.route("/api/payments/reminders", paymentRemindersRouter);
app.route("/api/team-files", filesRouter);
app.use("/api/weather/*", weatherRateLimit);
app.route("/api/weather", weatherRouter);

// Start background scheduler for payment reminders
startPaymentReminderScheduler();

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};
