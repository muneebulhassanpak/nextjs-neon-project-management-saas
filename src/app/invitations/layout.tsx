import { AuthShell } from "@/components/auth/auth-shell";

/** Reached while signed in (or mid sign-up), so there are no sign-in buttons. */
export default function Layout({ children }: LayoutProps<"/invitations">) {
  return <AuthShell minimal>{children}</AuthShell>;
}
