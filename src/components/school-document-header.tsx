import { GraduationCap } from "lucide-react";
import { useTenant } from "@/lib/tenant";

interface SchoolDocumentHeaderProps {
  title?: string;
  subtitle?: string;
}

export function SchoolDocumentHeader({ title, subtitle }: SchoolDocumentHeaderProps) {
  const { active } = useTenant();

  const initials = active.name
    ? active.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : "S";

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-6 print:border-gray-300"
      style={{ background: `linear-gradient(135deg, ${active.primaryColor}10, transparent)` }}
    >
      <div className="flex items-center gap-4">
        {active.logoUrl ? (
          <img
            src={active.logoUrl}
            alt={`${active.name} logo`}
            className="h-16 w-16 rounded-lg object-contain"
          />
        ) : (
          <div
            className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: active.primaryColor }}
          >
            {initials.length > 0 ? (
              <span className="text-xl font-bold">{initials}</span>
            ) : (
              <GraduationCap className="h-8 w-8" />
            )}
          </div>
        )}
        <div>
          <p className="text-lg font-bold leading-tight">{active.name}</p>
          {active.motto && (
            <p className="text-xs italic text-muted-foreground">"{active.motto}"</p>
          )}
          <p className="text-xs text-muted-foreground">
            {[active.district, active.province].filter(Boolean).join(", ")}
          </p>
          {(active.phone || active.email) && (
            <p className="text-xs text-muted-foreground">
              {[active.phone, active.email].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>

      {(title || subtitle) && (
        <div className="text-right">
          {title && <p className="text-sm font-semibold uppercase tracking-wide">{title}</p>}
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      )}
    </div>
  );
}
