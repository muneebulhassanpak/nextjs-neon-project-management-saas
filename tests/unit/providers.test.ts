import { afterEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted((): Record<string, string | undefined> => ({}));
vi.mock("@/env", () => ({ env }));

const { enabledSocialProviders } = await import("@/server/auth/providers");

describe("enabledSocialProviders", () => {
  afterEach(() => {
    for (const key of Object.keys(env)) env[key] = undefined;
  });

  it("is empty when no provider is configured", () => {
    expect(enabledSocialProviders()).toEqual([]);
  });

  it("only includes providers with both an id and a secret", () => {
    Object.assign(env, {
      GOOGLE_CLIENT_ID: "g",
      GOOGLE_CLIENT_SECRET: "s",
      GITHUB_CLIENT_ID: "only-id",
    });

    expect(enabledSocialProviders()).toEqual(["google"]);
  });

  it("includes both when both are configured", () => {
    Object.assign(env, {
      GOOGLE_CLIENT_ID: "g",
      GOOGLE_CLIENT_SECRET: "s",
      GITHUB_CLIENT_ID: "h",
      GITHUB_CLIENT_SECRET: "t",
    });

    expect(enabledSocialProviders()).toEqual(["google", "github"]);
  });
});
