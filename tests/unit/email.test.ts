import { describe, expect, it, vi } from "vitest";

import { ConsoleEmailSender, ResendEmailSender } from "@/server/integrations/email";
import * as templates from "@/server/integrations/email/templates";

const send = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

describe("email templates", () => {
  it("escapes names so they can't inject HTML", () => {
    const email = templates.invitation("a@example.com", "https://app/invitations/1", {
      inviterName: '<img src=x onerror="alert(1)">',
      organizationName: "Acme & Co",
      role: "member",
    });

    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(email.html).toContain("Acme &amp; Co");
    expect(email.text).toContain("https://app/invitations/1");
  });

  it.each([
    [
      "verifyEmail",
      templates.verifyEmail("a@example.com", "https://v"),
      "Verify your email address",
    ],
    ["magicLink", templates.magicLink("a@example.com", "https://v"), "Your sign-in link"],
    ["resetPassword", templates.resetPassword("a@example.com", "https://v"), "Reset your password"],
  ])("%s has a subject, the link and both formats", (_name, email, subject) => {
    expect(email.subject).toBe(subject);
    expect(email.html).toContain('href="https://v"');
    expect(email.text).toContain("https://v");
  });
});

describe("ConsoleEmailSender", () => {
  it("resolves without sending anything", async () => {
    await expect(
      new ConsoleEmailSender().send(templates.magicLink("a@b.co", "https://v")),
    ).resolves.toBeUndefined();
  });
});

describe("ResendEmailSender", () => {
  const email = templates.magicLink("a@example.com", "https://v");

  it("sends through Resend from the configured address", async () => {
    send.mockResolvedValueOnce({ data: { id: "1" }, error: null });

    await new ResendEmailSender("re_key", "Stackboard <hi@example.com>").send(email);

    expect(send).toHaveBeenCalledWith({ from: "Stackboard <hi@example.com>", ...email });
  });

  it("throws when Resend rejects the email", async () => {
    send.mockResolvedValueOnce({ data: null, error: { message: "Invalid API key" } });

    await expect(new ResendEmailSender("bad", "x@example.com").send(email)).rejects.toThrow(
      "Email could not be sent: Invalid API key",
    );
  });
});
