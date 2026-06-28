import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export function AccessGuard({ module, children }: { module: string; children: ReactNode }) {
  const { can } = useAuth();
  if (can(module) === false) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <p className="text-lg font-semibold">Access restricted</p>
        <p className="text-sm text-muted-foreground">
          You don't have permission to view this page. Contact your school administrator.
        </p>
        <Button asChild variant="outline">
          <Link to="/">Go to dashboard</Link>
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}
