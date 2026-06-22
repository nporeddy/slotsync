import { describe, it, expect, vi } from "vitest";
import { requireRole } from "./roles";

function fakeRes() {
  return {
    statusCode: 0,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

describe("requireRole", () => {
  it("calls next() when the role matches", () => {
    const req = { user: { userId: "u1", role: "PROVIDER" } } as any;
    const res = fakeRes() as any;
    const next = vi.fn();
    requireRole("PROVIDER")(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(0); 
  });

  it("returns 403 when the role does not match", () => {
    const req = { user: { userId: "u1", role: "CUSTOMER" } } as any;
    const res = fakeRes() as any;
    const next = vi.fn();
    requireRole("PROVIDER")(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("returns 401 when there is no user", () => {
    const req = {} as any;
    const res = fakeRes() as any;
    const next = vi.fn();
    requireRole("PROVIDER")(req, res, next);
    expect(res.statusCode).toBe(401);
  });
});
