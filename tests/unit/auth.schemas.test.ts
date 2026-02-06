import { describe, it, expect } from "vitest";
import { z } from "zod";

const schema = z.object({ email: z.string().email(), password: z.string().min(8) });

describe("auth schema", () => {
  it("rejects invalid email", () => {
    const r = schema.safeParse({ email: "x", password: "12345678" });
    expect(r.success).toBe(false);
  });
});
