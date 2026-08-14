import { FriendlyState } from "@/components/friendly-state";

// Rendered identically whether the ticket number doesn't exist, is
// malformed, or belongs to a department this signed-in agent has no
// membership for — never revealing which case applies.
export default function SupportTicketNotFound() {
  return (
    <FriendlyState
      title="We couldn't find that request"
      message="This request may not exist, or you may not have access to it. If you think this is a mistake, contact your system administrator."
      actions={[{ label: "Back to Support Queue", href: "/support" }]}
    />
  );
}
