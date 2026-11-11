import type { Email } from "./index";

/** Escapes text for safe use inside HTML. */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function layout(heading: string, body: string, action: { label: string; url: string }): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#171717">
    <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
      <tr><td>
        <p style="margin:0 0 24px;font-weight:600;font-size:16px">Stackboard</p>
        <h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(heading)}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#525252">${body}</p>
        <a href="${escapeHtml(action.url)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:500">${escapeHtml(action.label)}</a>
        <p style="margin:24px 0 0;font-size:12px;color:#a3a3a3">If you didn't expect this email, you can ignore it.</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function verifyEmail(to: string, url: string): Email {
  return {
    to,
    subject: "Verify your email address",
    html: layout("Confirm your email", "Click the button below to verify your email address.", {
      label: "Verify email",
      url,
    }),
    text: `Verify your email address for Stackboard:\n${url}`,
  };
}

export function magicLink(to: string, url: string): Email {
  return {
    to,
    subject: "Your sign-in link",
    html: layout("Sign in to Stackboard", "This link signs you in and expires in 5 minutes.", {
      label: "Sign in",
      url,
    }),
    text: `Sign in to Stackboard (expires in 5 minutes):\n${url}`,
  };
}

export function resetPassword(to: string, url: string): Email {
  return {
    to,
    subject: "Reset your password",
    html: layout("Reset your password", "Click the button below to choose a new password.", {
      label: "Reset password",
      url,
    }),
    text: `Reset your Stackboard password:\n${url}`,
  };
}

export function invitation(
  to: string,
  url: string,
  details: { inviterName: string; organizationName: string; role: string },
): Email {
  const who = `${details.inviterName} invited you to join ${details.organizationName} as ${details.role.toLowerCase()}.`;
  return {
    to,
    subject: `Join ${details.organizationName} on Stackboard`,
    html: layout(`Join ${details.organizationName}`, escapeHtml(who), {
      label: "Accept invitation",
      url,
    }),
    text: `${who}\n\nAccept the invitation:\n${url}`,
  };
}
