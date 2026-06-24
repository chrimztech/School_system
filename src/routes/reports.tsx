import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/reports")({
  component: ReportsRedirect,
});

function ReportsRedirect() {
  return <Navigate to="/reporting" replace />;
}
