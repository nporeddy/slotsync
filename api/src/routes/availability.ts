import { Router } from "express";
import { getAvailability } from "../availability/service";

export const availabilityRouter = Router();

// GET /availability?provider=dr-smith&service=<id>&from=2026-07-01&to=2026-07-07
availabilityRouter.get("/", async (req, res) => {
  const { provider, service, from, to } = req.query;

  if (
    typeof provider !== "string" ||
    typeof service !== "string" ||
    typeof from !== "string" ||
    typeof to !== "string"
  ) {
    return res
      .status(400)
      .json({ error: "provider, service, from, and to are required" });
  }

  const rangeStart = new Date(from);
  const rangeEnd = new Date(to);
  if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
    return res
      .status(400)
      .json({ error: "from and to must be valid dates (YYYY-MM-DD)" });
  }

  try {
    const slots = await getAvailability({
      providerSlug: provider,
      serviceId: service,
      rangeStart,
      rangeEnd,
    });
    res.json({ slots });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Failed to compute availability";
    const code = msg.includes("not found") ? 404 : 500;
    res.status(code).json({ error: msg });
  }
});
