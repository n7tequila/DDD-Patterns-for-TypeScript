import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import { isIdentifier, toMemberId } from "@example/shared-kernel";
import type { BookingEnv } from "@example/booking";

const actorHeaders = z.object({
  memberId: z.string().refine(isIdentifier, "x-member-id must be a UUID"),
  role: z.enum(["member", "admin"]),
});

/**
 * Demo authentication: trusts two headers. Replace with real authentication before any real use.
 * It checks only who the caller is; what they may do with a record is decided by the aggregate.
 */
export const demoAuth: MiddlewareHandler<BookingEnv> = async (c, next) => {
  const parsed = actorHeaders.safeParse({ memberId: c.req.header("x-member-id"), role: c.req.header("x-member-role") ?? "member" });
  if (!parsed.success) return c.json({ code: "UNAUTHENTICATED", message: "missing or invalid identity" }, 401);
  c.set("actor", { memberId: toMemberId(parsed.data.memberId), role: parsed.data.role });
  return next();
};
