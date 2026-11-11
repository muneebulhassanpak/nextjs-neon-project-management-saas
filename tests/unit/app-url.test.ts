import { describe, expect, it } from "vitest";

import { resolveAppUrl, resolveTrustedOrigins } from "@/server/auth/app-url";

/** A process environment with only these variables set. */
function vars(values: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { NODE_ENV: "production", ...values };
}

describe("resolveAppUrl", () => {
  it("prefers BETTER_AUTH_URL", () => {
    expect(
      resolveAppUrl(
        vars({ BETTER_AUTH_URL: "https://app.example.com", VERCEL_URL: "x.vercel.app" }),
      ),
    ).toBe("https://app.example.com");
  });

  it("uses the production domain in production on Vercel", () => {
    expect(
      resolveAppUrl(
        vars({
          VERCEL_ENV: "production",
          VERCEL_PROJECT_PRODUCTION_URL: "stackboard.vercel.app",
          VERCEL_URL: "stackboard-abc123.vercel.app",
        }),
      ),
    ).toBe("https://stackboard.vercel.app");
  });

  it("uses the branch URL for previews", () => {
    expect(
      resolveAppUrl(
        vars({
          VERCEL_ENV: "preview",
          VERCEL_BRANCH_URL: "stackboard-git-feat.vercel.app",
          VERCEL_URL: "stackboard-abc123.vercel.app",
        }),
      ),
    ).toBe("https://stackboard-git-feat.vercel.app");
  });

  it("falls back to the deployment URL, then the local URL", () => {
    expect(resolveAppUrl(vars({ VERCEL_URL: "stackboard-abc123.vercel.app" }))).toBe(
      "https://stackboard-abc123.vercel.app",
    );
    expect(resolveAppUrl(vars({}))).toBe("http://localhost:3000");
  });
});

describe("resolveTrustedOrigins", () => {
  it("trusts every URL the deployment answers on, once each", () => {
    expect(
      resolveTrustedOrigins(
        vars({
          VERCEL_ENV: "preview",
          VERCEL_PROJECT_PRODUCTION_URL: "stackboard.vercel.app",
          VERCEL_BRANCH_URL: "stackboard-git-feat.vercel.app",
          VERCEL_URL: "stackboard-abc123.vercel.app",
        }),
      ),
    ).toEqual([
      "https://stackboard-git-feat.vercel.app",
      "https://stackboard.vercel.app",
      "https://stackboard-abc123.vercel.app",
    ]);
  });
});
