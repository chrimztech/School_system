import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BookOpen, LifeBuoy, Search } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Article = {
  title: string;
  category: string;
  audience: string;
  summary: string;
  route: string;
};

const articles: Article[] = [];

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
          <Button asChild>
            <Link to="/help"><LifeBuoy className="mr-2 h-4 w-4" />Open support desk</Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search backups, onboarding, fees, risk reviews..." />
          </div>
          <div className="mt-4 space-y-3">
            {filtered.map((article) => (
              <div key={article.title} className="rounded-xl border border-border/70 bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{article.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{article.summary}</p>
                  </div>
                  <Badge variant="outline">{article.audience}</Badge>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <Badge variant="secondary">{article.category}</Badge>
                  <Button size="sm" variant="outline" asChild>
                    <Link to={article.route}>Open workflow</Link>
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
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link to="/onboarding">New school launch pack</Link>
              </Button>
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link to="/reporting">Reporting and BI guides</Link>
              </Button>
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link to="/security">Security operations handbook</Link>
              </Button>
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link to="/risk-register">Governance review toolkit</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm font-semibold text-foreground">Need hands-on help?</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Open the support desk to submit a ticket, review FAQs, or escalate a production issue with the operations team.
            </p>
            <Button className="mt-4 w-full" asChild>
              <Link to="/help">Go to help & support</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
