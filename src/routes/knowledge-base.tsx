import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BookOpen, LifeBuoy, Search } from "lucide-react";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";

import { PageHeader } from "@/components/page-header";
import { badgeSx } from "@/lib/utils";

type Article = {
  title: string;
  category: string;
  audience: string;
  summary: string;
  route: string;
};

const articles: Article[] = [
  {
    title: "Onboard a new school",
    category: "Setup",
    audience: "Super admin",
    summary: "Provision a school workspace — identity, curriculum, campuses, branding, plan, and the first admin login — end to end.",
    route: "/onboarding",
  },
  {
    title: "Brand a school's login and workspace",
    category: "Setup",
    audience: "School admin",
    summary: "Set logo, favicon, and primary/secondary colours so a school's sign-in page and app match their identity.",
    route: "/settings",
  },
  {
    title: "Take and restore a backup",
    category: "Data & backups",
    audience: "School admin",
    summary: "Trigger an on-demand export of a school's data, download it, or restore a school to a previous snapshot.",
    route: "/backups",
  },
  {
    title: "Mark a class register and read the weekly trend",
    category: "Academic operations",
    audience: "Teacher",
    summary: "Submit daily attendance, see per-class breakdowns, and review the last 7 days' attendance rate.",
    route: "/attendance",
  },
  {
    title: "Verify and publish exam results",
    category: "Academic operations",
    audience: "HOD / Careers Guidance",
    summary: "Move a mark sheet through the approval workflow — HOD verification, then release to report cards and parent accounts.",
    route: "/results-approvals",
  },
  {
    title: "Enter, import, and correct assessment marks",
    category: "Academic operations",
    audience: "Teacher",
    summary: "Fill in a results sheet by hand or bulk-import via CSV, and submit it for HOD review.",
    route: "/assessments",
  },
  {
    title: "Record a fee payment and send reminders",
    category: "Finance",
    audience: "Finance officer",
    summary: "Log a payment against a student's balance, print a receipt, or send bulk payment reminders to guardians.",
    route: "/fees",
  },
  {
    title: "Reporting and BI guides",
    category: "Reporting",
    audience: "Enterprise leadership",
    summary: "Build and manage saved reports across academic, financial, and operational data.",
    route: "/reporting",
  },
  {
    title: "Manage staff accounts, roles, and permissions",
    category: "Administration",
    audience: "School admin",
    summary: "Create logins for staff, assign roles, reset passwords, and understand what each role can see.",
    route: "/user-management",
  },
  {
    title: "Security operations handbook",
    category: "Security",
    audience: "Security officer",
    summary: "Track access reviews, incidents, and operational safeguards across a school's estate.",
    route: "/security",
  },
  {
    title: "Governance review toolkit",
    category: "Compliance",
    audience: "Compliance officer",
    summary: "Log compliance items, run risk reviews, and keep policy documentation current.",
    route: "/risk-register",
  },
  {
    title: "Approve pending platform changes",
    category: "Platform operations",
    audience: "Super admin",
    summary: "Review and approve or escalate pending platform-level requests awaiting sign-off.",
    route: "/approval-center",
  },
];

export const Route = createFileRoute("/knowledge-base")({
  head: () => ({ meta: [{ title: "Knowledge Base - SRMS" }] }),
  component: KnowledgeBasePage,
});

function KnowledgeBasePage() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((article) =>
      [article.title, article.category, article.audience, article.summary].some((value) => value.toLowerCase().includes(q)),
    );
  }, [query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Base"
        description="Searchable operating guides for school admins, finance teams, teachers and enterprise leadership."
        actions={
          <Button variant="contained" component={Link} to="/help" startIcon={<LifeBuoy size={16} />}>
            Open support desk
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="relative">
            <TextField
              fullWidth
              size="small"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search backups, onboarding, fees, risk reviews..."
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> } }}
            />
          </div>
          <div className="mt-4 space-y-3">
            {filtered.map((article) => (
              <div key={article.title} className="rounded-xl border border-border/70 bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{article.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{article.summary}</p>
                  </div>
                  <Chip size="small" label={article.audience} sx={badgeSx("outline")} />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <Chip size="small" label={article.category} sx={badgeSx("secondary")} />
                  <Button size="small" variant="outlined" component={Link} to={article.route}>
                    Open workflow
                  </Button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No knowledge articles match your search yet.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <BookOpen className="h-4 w-4" />
              Quick collections
            </div>
            <div className="mt-4 space-y-3">
              <Button fullWidth sx={{ justifyContent: "flex-start" }} variant="outlined" component={Link} to="/onboarding">
                New school launch pack
              </Button>
              <Button fullWidth sx={{ justifyContent: "flex-start" }} variant="outlined" component={Link} to="/reporting">
                Reporting and BI guides
              </Button>
              <Button fullWidth sx={{ justifyContent: "flex-start" }} variant="outlined" component={Link} to="/security">
                Security operations handbook
              </Button>
              <Button fullWidth sx={{ justifyContent: "flex-start" }} variant="outlined" component={Link} to="/risk-register">
                Governance review toolkit
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm font-semibold text-foreground">Need hands-on help?</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Open the support desk to submit a ticket, review FAQs, or escalate a production issue with the operations team.
            </p>
            <Button className="mt-4" fullWidth variant="contained" component={Link} to="/help">
              Go to help & support
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
