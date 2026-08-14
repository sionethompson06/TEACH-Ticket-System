import { FriendlyState } from "@/components/friendly-state";

// Rendered identically whether the ticket number doesn't exist, is
// malformed, or belongs to a request this signed-in user isn't
// authorized to see — never revealing which case applies.
export default function TicketNotFound() {
  return (
    <FriendlyState
      title="We couldn't find that request"
      message="This request may not exist, or you may not have access to it. If you think this is a mistake, reach out to your support team."
      actions={[{ label: "Back to My Requests", href: "/requests" }]}
    />
  );
}
