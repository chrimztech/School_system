import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/s/$slug")({
  component: SchoolSlugRedirect,
});

const PENDING_SLUG_KEY = "srms_pending_slug";

function SchoolSlugRedirect() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(PENDING_SLUG_KEY, slug);
    }
    navigate({ to: "/login", replace: true });
  }, [slug, navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
