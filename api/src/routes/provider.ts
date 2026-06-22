import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { getOwnedProvider } from "../lib/ownership";

export const providerRouter = Router();

providerRouter.get(
  "/me",
  requireAuth,
  requireRole("PROVIDER"),
  async (req, res) => {
    const provider = await getOwnedProvider(req.user!.userId);
    if (!provider)
      return res
        .status(404)
        .json({ error: "No provider profile for this user" });
    res.json({ provider });
  },
);

providerRouter.post(
  "/services",
  requireAuth,
  requireRole("PROVIDER"),
  async (req, res) => {
    const provider = await getOwnedProvider(req.user!.userId);
    if (!provider)
      return res
        .status(404)
        .json({ error: "No provider profile for this user" });

    const { name, durationMinutes, priceCents, depositCents } = req.body ?? {};
    if (!name || !durationMinutes || priceCents == null) {
      return res
        .status(400)
        .json({ error: "name, durationMinutes, priceCents are required" });
    }
    const service = await prisma.service.create({
      data: {
        providerId: provider.id, 
        name,
        durationMinutes,
        priceCents,
        depositCents: depositCents ?? 0,
      },
    });
    res.status(201).json({ service });
  },
);
