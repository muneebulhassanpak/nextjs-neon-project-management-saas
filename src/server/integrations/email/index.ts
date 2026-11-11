import "server-only";
import { Resend } from "resend";

import { env } from "@/env";
import { logger } from "@/server/logger";

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailSender {
  send(email: Email): Promise<void>;
}

/** Prints emails to the log, so sign-up and invites work locally without an email account. */
export class ConsoleEmailSender implements EmailSender {
  send(email: Email): Promise<void> {
    logger.info(
      { to: email.to, subject: email.subject },
      `email (console mode)\n\n${email.text}\n`,
    );
    return Promise.resolve();
  }
}

export class ResendEmailSender implements EmailSender {
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.client = new Resend(apiKey);
  }

  async send(email: Email): Promise<void> {
    const { error } = await this.client.emails.send({ from: this.from, ...email });
    if (error) {
      logger.error({ to: email.to, subject: email.subject, error }, "email send failed");
      throw new Error(`Email could not be sent: ${error.message}`);
    }
  }
}

function createEmailSender(): EmailSender {
  if (env.EMAIL_MODE === "resend") {
    if (!env.RESEND_API_KEY) throw new Error("EMAIL_MODE=resend needs RESEND_API_KEY.");
    return new ResendEmailSender(env.RESEND_API_KEY, env.EMAIL_FROM);
  }
  return new ConsoleEmailSender();
}

export const emailSender: EmailSender = createEmailSender();
