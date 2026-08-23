import type { ReactNode } from "react";
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
} from "@mui/material";
import { Building2, ExternalLink, Settings, Users } from "lucide-react";

import {
  ACADEMIC_LEVEL_META,
  FEATURE_META,
  FEATURE_ORDER,
  PLAN_CATALOG,
  type Tenant,
} from "@/lib/tenant";
import { PLATFORM_DOMAIN } from "@/lib/tenant-host";

function DetailField({ label, value }: { label: string; value?: ReactNode }) {
  const isEmpty = value === undefined || value === null || value === "";
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm text-foreground">{isEmpty ? "—" : value}</dd>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-background/50 p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <dl className="mt-4 grid gap-x-4 gap-y-4 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

export function SchoolDetailsDialog({
  school,
  open,
  onClose,
  onEditSettings,
  onManageUsers,
}: {
  school: Tenant | null;
  open: boolean;
  onClose: () => void;
  onEditSettings: () => void;
  onManageUsers: () => void;
}) {
  if (!school) return null;

  const enabledFeatures = FEATURE_ORDER.filter((feature) => school.features[feature]);
  const loginUrl = school.slug ? `https://${school.slug}.${PLATFORM_DOMAIN}/login` : undefined;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth scroll="paper">
      <DialogTitle>
        <div className="flex items-start gap-3 pr-8">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: school.primaryColor }}
          >
            {school.logoUrl ? (
              <img src={school.logoUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              school.shortCode.slice(0, 2)
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span>{school.name}</span>
              <Chip
                size="small"
                label={school.subscription.status.replace("_", " ")}
                color={
                  school.subscription.status === "active"
                    ? "success"
                    : school.subscription.status === "suspended"
                      ? "error"
                      : "default"
                }
                sx={{ textTransform: "capitalize" }}
              />
            </div>
            <p className="mt-1 text-sm font-normal text-muted-foreground">
              {school.shortCode} · {school.district}, {school.province}
            </p>
          </div>
        </div>
      </DialogTitle>

      <DialogContent dividers>
        <div className="grid gap-4 lg:grid-cols-2">
          <DetailSection title="Identity and registration">
            <DetailField
              label="School ID"
              value={<span className="font-mono text-xs">{school.id}</span>}
            />
            <DetailField label="Short code" value={school.shortCode} />
            <DetailField label="Workspace slug" value={school.slug} />
            <DetailField
              label="Login URL"
              value={
                loginUrl ? (
                  <a
                    href={loginUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {loginUrl}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : undefined
              }
            />
            <DetailField label="School type" value={school.type.replace("_", " ")} />
            <DetailField label="Ownership" value={school.ownership} />
            <DetailField label="Category" value={school.category} />
            <DetailField label="Gender" value={school.gender} />
            <DetailField label="Registration number" value={school.registrationNo} />
            <DetailField label="Ministry code" value={school.moeCode} />
            <DetailField label="Exam centre number" value={school.examCentreNo} />
            <DetailField label="TPIN" value={school.tpinNo} />
            <DetailField label="Year founded" value={school.yearFounded} />
            <DetailField label="Motto" value={school.motto} />
          </DetailSection>

          <DetailSection title="Contact and location">
            <DetailField label="Email" value={school.email} />
            <DetailField label="Phone" value={school.phone} />
            <DetailField label="Alternative phone" value={school.altPhone} />
            <DetailField
              label="Website"
              value={
                school.website ? (
                  <a
                    href={school.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {school.website}
                  </a>
                ) : undefined
              }
            />
            <DetailField label="Physical address" value={school.physicalAddress} />
            <DetailField label="Postal address" value={school.poBox} />
            <DetailField label="City" value={school.city} />
            <DetailField label="Postal code" value={school.postalCode} />
            <DetailField label="District" value={school.district} />
            <DetailField label="Province" value={school.province} />
            <DetailField label="GPS coordinates" value={school.gpsCoordinates} />
          </DetailSection>

          <DetailSection title="Leadership">
            <DetailField label="Head teacher" value={school.headTeacher} />
            <DetailField label="Head teacher email" value={school.headTeacherEmail} />
            <DetailField label="Deputy head" value={school.deputyHead} />
            <DetailField label="Board chair" value={school.boardChair} />
          </DetailSection>

          <DetailSection title="Academic setup">
            <DetailField label="Curriculum" value={school.curriculum} />
            <DetailField label="Language of instruction" value={school.languageOfInstruction} />
            <DetailField
              label="Academic levels"
              value={school.levels.map((level) => ACADEMIC_LEVEL_META[level].label).join(", ")}
            />
            <DetailField
              label="Current period"
              value={`Term ${school.currentTerm}, ${school.currentYear}`}
            />
            <DetailField label="Term starts" value={school.termStart} />
            <DetailField label="Term ends" value={school.termEnd} />
            <DetailField label="Week starts" value={school.weekStart} />
            <DetailField label="Grading scale" value={school.gradingScale} />
            <DetailField
              label="Pass mark"
              value={school.passMark === undefined ? undefined : `${school.passMark}%`}
            />
            <DetailField
              label="Result publication"
              value={school.resultPublicationMode.replace("_", " ")}
            />
            <DetailField label="Students" value={school.totalStudents.toLocaleString()} />
            <DetailField label="Teachers" value={school.totalTeachers.toLocaleString()} />
            <DetailField label="Classes" value={school.totalClasses.toLocaleString()} />
          </DetailSection>

          <DetailSection title="Subscription and support">
            <DetailField label="Plan" value={PLAN_CATALOG[school.subscription.planId].name} />
            <DetailField label="Status" value={school.subscription.status.replace("_", " ")} />
            <DetailField label="Billing cycle" value={school.subscription.billingCycle} />
            <DetailField
              label="Amount"
              value={`K ${school.subscription.amount.toLocaleString()}`}
            />
            <DetailField label="Next invoice" value={school.subscription.nextInvoiceDate} />
            <DetailField label="Renewal date" value={school.subscription.renewalDate} />
            <DetailField
              label="Campus allowance"
              value={`${school.campuses.length} / ${school.subscription.campusLimit}`}
            />
            <DetailField
              label="Learner allowance"
              value={`${school.totalStudents.toLocaleString()} / ${school.subscription.learnerLimit.toLocaleString()}`}
            />
            <DetailField
              label="SMS usage"
              value={`${school.subscription.smsUsed.toLocaleString()} / ${school.subscription.smsQuota.toLocaleString()}`}
            />
            <DetailField label="Support level" value={school.subscription.supportLevel} />
            <DetailField label="Billing contact" value={school.subscription.billingContact} />
            <DetailField label="Notes" value={school.subscription.notes} />
          </DetailSection>

          <DetailSection title="Branding and finance">
            <DetailField
              label="Brand colours"
              value={
                <span className="flex flex-wrap items-center gap-2">
                  {[school.primaryColor, school.secondaryColor, school.accentColor]
                    .filter(Boolean)
                    .map((color) => (
                      <span
                        key={color}
                        className="inline-flex items-center gap-1 font-mono text-xs"
                      >
                        <span
                          className="h-4 w-4 rounded border border-border"
                          style={{ backgroundColor: color }}
                        />
                        {color}
                      </span>
                    ))}
                </span>
              }
            />
            <DetailField label="Font" value={school.fontFamily} />
            <DetailField label="Currency" value={school.currency} />
            <DetailField label="Bank" value={school.bankName} />
            <DetailField label="Bank account" value={school.bankAccount} />
            <DetailField label="Bank branch" value={school.bankBranch} />
            <DetailField label="Offline mode" value={school.offlineMode ? "Enabled" : "Disabled"} />
            <DetailField label="Report footer" value={school.reportFooter} />
          </DetailSection>
        </div>

        <section className="mt-4 rounded-xl border border-border bg-background/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              Campuses ({school.campuses.length})
            </h3>
            <span className="text-xs text-muted-foreground">
              {school.campuses
                .reduce((sum, campus) => sum + campus.studentCount, 0)
                .toLocaleString()}{" "}
              recorded students
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {school.campuses.map((campus) => (
              <div key={campus.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Building2 className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{campus.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {campus.code} · {campus.district}
                        {campus.city ? `, ${campus.city}` : ""}
                      </p>
                    </div>
                  </div>
                  <Chip size="small" label={campus.status} sx={{ textTransform: "capitalize" }} />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {campus.levels.map((level) => ACADEMIC_LEVEL_META[level].label).join(", ") ||
                    "No levels configured"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {campus.studentCount.toLocaleString()} students ·{" "}
                  {campus.teacherCount.toLocaleString()} teachers
                </p>
                {(campus.address || campus.phone) && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {[campus.address, campus.phone].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-border bg-background/50 p-4">
          <h3 className="text-sm font-semibold text-foreground">
            Enabled modules ({enabledFeatures.length})
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {enabledFeatures.map((feature) => (
              <Chip
                key={feature}
                size="small"
                label={FEATURE_META[feature].label}
                variant="outlined"
              />
            ))}
            {enabledFeatures.length === 0 && (
              <p className="text-sm text-muted-foreground">No optional modules enabled.</p>
            )}
          </div>
        </section>
      </DialogContent>

      <Divider />
      <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
        <Button color="inherit" onClick={onClose}>
          Close
        </Button>
        <Button variant="outlined" startIcon={<Users size={16} />} onClick={onManageUsers}>
          Manage users
        </Button>
        <Button variant="contained" startIcon={<Settings size={16} />} onClick={onEditSettings}>
          Edit school settings
        </Button>
      </DialogActions>
    </Dialog>
  );
}
