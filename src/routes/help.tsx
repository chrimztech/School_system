import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { LifeBuoy, BookOpen, MessageCircle, Mail, Phone, Send } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/help")({
  head: () => ({ meta: [{ title: "Help - SRMS" }] }),
  component: HelpPage,
});

const faqs = [
  { q: "How do I onboard a new school?", a: "Open the school switcher and choose Onboard new school. Complete the wizard with branding, statutory details, and finance setup." },
  { q: "How is data backed up?", a: "Nightly encrypted snapshots run at 02:00 CAT and are retained for 90 days. You can also trigger manual snapshots from Backups & Data." },
  { q: "Can parents pay via Mobile Money?", a: "Yes. Enable MTN MoMo or Airtel Money in Integrations. Parents then see those channels on fee statements." },
  { q: "How do I add a new teacher?", a: "Go to Teachers, choose Add teacher, then assign subjects and classes before sending the invitation." },
  { q: "Are records ECZ-compliant?", a: "Reports follow ECZ grading conventions and candidate registration workflows when the ECZ integration is enabled." },
  { q: "How do I manage user permissions?", a: "Use Access Control or User Management to assign roles, inspect the role matrix, and review least-privilege access." },
];

function HelpPage() {
  const { isSystemAdmin } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Help & Support"
        description="Documentation, FAQs, and direct access to the support team."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/knowledge-base"><BookOpen className="mr-2 h-4 w-4" />Knowledge base</Link>
            </Button>
            {isSystemAdmin && (
              <Button asChild>
                <Link to="/support-desk"><LifeBuoy className="mr-2 h-4 w-4" />Support desk</Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link to="/knowledge-base" className="flex items-start gap-3 rounded-xl border border-border bg-card p-5 text-left transition hover:border-primary">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><BookOpen className="h-5 w-5" /></div>
          <div>
            <p className="font-semibold">Documentation</p>
            <p className="text-xs text-muted-foreground">Step-by-step guides</p>
          </div>
        </Link>

        <button onClick={() => toast.success("Live chat connected")} className="flex items-start gap-3 rounded-xl border border-border bg-card p-5 text-left transition hover:border-primary">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><MessageCircle className="h-5 w-5" /></div>
          <div>
            <p className="font-semibold">Live chat</p>
            <p className="text-xs text-muted-foreground">Avg response 3 min</p>
          </div>
        </button>

        <a href="tel:+260211555200" className="flex items-start gap-3 rounded-xl border border-border bg-card p-5 text-left transition hover:border-primary">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Phone className="h-5 w-5" /></div>
          <div>
            <p className="font-semibold">Call support</p>
            <p className="text-xs text-muted-foreground">+260 211 555 200</p>
          </div>
        </a>
      </div>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold"><LifeBuoy className="h-4 w-4" />Frequently asked</h2>
        <Accordion type="single" collapsible>
          {faqs.map((faq, index) => (
            <AccordionItem key={faq.q} value={`faq-${index}`}>
              <AccordionTrigger className="text-left text-sm">{faq.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{faq.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold"><Mail className="h-4 w-4" />Open a support ticket</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!subject.trim() || !message.trim()) {
              toast.error("Please fill in both fields");
              return;
            }
            toast.success(`Ticket submitted - reference #SRMS-${Date.now().toString().slice(-5)}`);
            setSubject("");
            setMessage("");
          }}
          className="space-y-3"
        >
          <Input placeholder="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={120} />
          <Textarea placeholder="Describe the issue..." value={message} onChange={(event) => setMessage(event.target.value)} rows={5} maxLength={1000} />
          <div className="flex justify-end">
            <Button type="submit"><Send className="mr-1 h-4 w-4" />Submit ticket</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
