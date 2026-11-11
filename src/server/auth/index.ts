import "server-only";
import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink, organization } from "better-auth/plugins";

import { env } from "@/env";
import { orgSlugSchema } from "@/lib/organization";
import { ac, roles } from "@/lib/roles";
import { db } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { emailSender } from "@/server/integrations/email";
import * as emails from "@/server/integrations/email/templates";

import { resolveAppUrl, resolveTrustedOrigins } from "./app-url";

const appUrl = resolveAppUrl();

/**
 * Member changes go through our Server Actions, which enforce the full permission matrix
 * (e.g. admins can't change other admins). The plugin's own HTTP endpoints for them are closed;
 * server-side `auth.api` calls are unaffected.
 */
const SERVER_ONLY_PATHS = new Set([
  "/organization/update-member-role",
  "/organization/remove-member",
  "/organization/add-member",
  "/organization/invite-member",
  "/organization/delete",
  "/organization/update",
]);

const socialProviders = {
  ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
    : {}),
  ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
    ? { github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET } }
    : {}),
};

export const auth = betterAuth({
  appName: "Stackboard",
  baseURL: appUrl,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: resolveTrustedOrigins(),
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      await emailSender.send(emails.resetPassword(user.email, url));
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    // Signing in before verifying sends a fresh link instead of a dead end.
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await emailSender.send(emails.verifyEmail(user.email, url));
    },
  },
  socialProviders,
  session: {
    // Keeps session lookups off the database for 5 minutes at a time.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: {
    enabled: env.NODE_ENV === "production" && env.AUTH_RATE_LIMIT,
    storage: "database",
  },
  hooks: {
    before: createAuthMiddleware((ctx) => {
      if (ctx.request && SERVER_ONLY_PATHS.has(ctx.path)) {
        throw new APIError("FORBIDDEN", { message: "Use the app to manage members." });
      }
      return Promise.resolve();
    }),
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await emailSender.send(emails.magicLink(email, url));
      },
    }),
    organization({
      ac,
      roles,
      creatorRole: "owner",
      invitationExpiresIn: 7 * 24 * 60 * 60,
      cancelPendingInvitationsOnReInvite: true,
      requireEmailVerificationOnInvitation: true,
      organizationHooks: {
        // The same slug rules as the app's forms, for requests that reach the API directly.
        beforeCreateOrganization: ({ organization: org }) => {
          if (!orgSlugSchema.safeParse(org.slug).success) {
            throw new APIError("BAD_REQUEST", { message: "This URL isn't available." });
          }
          return Promise.resolve();
        },
      },
      sendInvitationEmail: async ({ email, role, organization: org, inviter, id }) => {
        const url = `${appUrl}/invitations/${id}`;
        await emailSender.send(
          emails.invitation(email, url, {
            inviterName: inviter.user.name,
            organizationName: org.name,
            role,
          }),
        );
      },
    }),
    // Must be last: lets Server Actions set auth cookies.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
