import { Link } from "@tanstack/react-router";
import { PackageX, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useTenant, isTenantModuleEnabled } from "@/lib/tenant";

export function AccessGuard({ module, children }: { module: string; children: ReactNode }) {
  const { can, isSystemAdmin } = useAuth();
  const { active } = useTenant();

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

  if (!isSystemAdmin && !isTenantModuleEnabled(active, module)) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <PackageX className="h-10 w-10 text-muted-foreground" />
        <p className="text-lg font-semibold">Module not enabled</p>
        <p className="text-sm text-muted-foreground">
          This module isn't enabled for {active.name}. A school administrator can turn it on in Settings.
        </p>
        <Button asChild variant="outline">
          <Link to="/settings">Go to Settings</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
