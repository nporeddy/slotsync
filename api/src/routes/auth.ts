import { Router } from "express";
import { prisma } from "../prisma";
import { hashPassword, verifyPassword, signToken } from "../lib/auth";
import { requireAuth } from "../middleware/auth";

export const authRouter = Router();

authRouter.post("/signup", async (req, res) => {
  const { email, password, role } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }
  const user = await prisma.user.create({
    data: {
      email,
      password: await hashPassword(password),
      role: role === "PROVIDER" ? "PROVIDER" : "CUSTOMER",
    },
  });
  const token = signToken({ userId: user.id, role: user.role });
  res
    .status(201)
    .json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = signToken({ userId: user.id, role: user.role });
  res.json({
    token,
    user: { id: user.id, email: user.email, role: user.role },
  });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, email: true, role: true, createdAt: true },
  });
  res.json({ user });
});
