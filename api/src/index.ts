import "dotenv/config";
import express from "express";
import { Pool } from "pg";
import Redis from "ioredis";
import { prisma } from "./prisma";

const app = express();
const PORT = process.env.PORT ?? 4000;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    await redis.ping();
    res.json({ status: "ok", postgres: "up", redis: "up" });
  } catch (err) {
    res.status(500).json({ status: "error", error: String(err) });
  }
});

// Temporary Day 3 test route — proves Prisma can write + read
app.get("/test-prisma", async (_req, res) => {
  const user = await prisma.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      password: "placeholder",
      role: "PROVIDER",
    },
  });
  const count = await prisma.user.count();
  res.json({ created: user, totalUsers: count });
});

async function start() {
  await pool.query("SELECT 1");
  console.log("✅ Postgres connected");
  const pong = await redis.ping();
  console.log(`✅ Redis connected (${pong})`);
  app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
}

start().catch((err) => {
  console.error("❌ Startup failed:", err);
  process.exit(1);
});
