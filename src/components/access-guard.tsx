import { Link } from "@tanstack/react-router";
import { PackageX, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@mui/material";
import { useAuth, type Role } from "@/lib/auth";
import { useTenant, isTenantModuleEnabled } from "@/lib/tenant";
import { routeAccessForPath } from "@/lib/route-access";

export function AccessGuard({
  module,
  allowedRoles,
  children,
}: {
  module: string;
  allowedRoles?: readonly Role[];
  children: ReactNode;
}) {
  const { can, isSystemAdmin, user } = useAuth();
  const { active } = useTenant();

  // Checked first, and independently of can(): can() already folds "is this module even
  // enabled for the tenant" into its answer (see useAuth's can(), which calls
  // isModuleEnabled internally), so can(module) === false is equally true whether the real
  // reason is "your role has no access" or "this module is switched off for the school".
  // Checking role second — via can(), only once we know the module itself is enabled — is
  // what makes each branch below actually correspond to its message; the reverse order left
  // this branch unreachable and showed every disabled-module page as if it were a denied-role
  // page, which told a school admin to "contact your school administrator" for a module only
  // they can turn on.
  if (!isSystemAdmin && !isTenantModuleEnabled(active, module)) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <PackageX className="h-10 w-10 text-muted-foreground" />
        <p className="text-lg font-semibold">Module not enabled</p>
        <p className="text-sm text-muted-foreground">
          This module isn't enabled for {active.name}. A school administrator can turn it on in Settings.
        </p>
        <Button component={Link} to="/settings" variant="outlined">
          Go to Settings
        </Button>
      </div>
    );
  }

  if (can(module) === false || (allowedRoles && (!user || !allowedRoles.includes(user.role)))) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <p className="text-lg font-semibold">Access restricted</p>
        <p className="text-sm text-muted-foreground">
          You don't have permission to view this page. Contact your school administrator.
        </p>
        <Button component={Link} to="/" variant="outlined">
          Go to dashboard
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}

export function RouteAccessBoundary({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  const rule = routeAccessForPath(pathname);
  if (!rule.module) return <>{children}</>;
  return (
    <AccessGuard module={rule.module} allowedRoles={rule.allowedRoles}>
      {children}
    </AccessGuard>
  );
}
