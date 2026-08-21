import { createFileRoute } from "@tanstack/react-router";

import { AccessGuard } from "@/components/access-guard";
import { ParentDashboard } from "@/routes/index";

export const Route = createFileRoute("/my-children")({
  head: () => ({ meta: [{ title: "My Children — SRMS" }] }),
  component: MyChildrenPage,
});

// Staff can also be a parent at the same school — a login account only ever has one role
// (email is globally unique), so there's no separate "parent" account to switch to. This
// reuses the same guardian-email/phone lookup the Parent Portal itself uses, surfaced as an
// extra page alongside a staff member's normal dashboard rather than replacing it.
function MyChildrenPage() {
  return (
    <AccessGuard module="my-children">
      <ParentDashboard />
    </AccessGuard>
  );
}
