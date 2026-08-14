import { FriendlyState } from "@/components/friendly-state";

// Handles any URL that doesn't match a route anywhere in the app —
// ticket-specific not-found pages (src/app/requests/[ticketNumber] and
// src/app/support/[ticketNumber]) take precedence within their own
// segment and keep their own tailored copy.
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col px-6 py-10 sm:px-10">
      <FriendlyState
        title="We couldn't find this page."
        message="The page you're looking for doesn't exist or may have moved."
        actions={[{ label: "Return Home", href: "/" }]}
      />
    </div>
  );
}
