import { afterEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted((): Record<string, string | undefined> => ({
  EMAIL_FROM: "Stackboard <hi@example.com>",
  LOG_LEVEL: "silent",
}));
vi.mock("@/env", () => ({ env }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: vi.fn() };
  },
}));

async function loadSender() {
  vi.resetModules();
  return (await import("@/server/integrations/email")).emailSender;
}

describe("emailSender", () => {
  afterEach(() => {
    env.EMAIL_MODE = undefined;
    env.RESEND_API_KEY = undefined;
  });

  it("logs emails by default", async () => {
    expect((await loadSender()).constructor.name).toBe("ConsoleEmailSender");
  });

  it("sends through Resend when configured", async () => {
    Object.assign(env, { EMAIL_MODE: "resend", RESEND_API_KEY: "re_key" });

    expect((await loadSender()).constructor.name).toBe("ResendEmailSender");
  });

  it("refuses to start in Resend mode without a key", async () => {
    env.EMAIL_MODE = "resend";

    await expect(loadSender()).rejects.toThrow("EMAIL_MODE=resend needs RESEND_API_KEY.");
  });
});
