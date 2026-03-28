import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { Hono } from "hono";
import { cors } from "hono/cors";
import "./env";
import { sampleRouter } from "./routes/sample";
import { authRouter } from "./routes/auth";
import { notificationsRouter } from "./routes/notifications";
import { paymentsRouter } from "./routes/payments";
import { connectRouter } from "./routes/connect";
import { filesRouter } from "./routes/files";
import { paymentRemindersRouter, startPaymentReminderScheduler } from "./routes/payment-reminders";
import { logger } from "hono/logger";

const app = new Hono();

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
app.route("/api/sample", sampleRouter);
app.route("/api/auth", authRouter);
app.route("/api/notifications", notificationsRouter);
app.route("/api/payments", paymentsRouter);
app.route("/api/payments/connect", connectRouter);
app.route("/api/payments/reminders", paymentRemindersRouter);
app.route("/api/team-files", filesRouter);

// Start background scheduler for payment reminders
startPaymentReminderScheduler();

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};
