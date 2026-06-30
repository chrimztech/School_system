import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BadgeCheck, CheckCircle2, FileSignature, Printer, ShieldAlert, ShieldCheck, Wallet, X } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { appendApprovalItem, appendExportJob, appendPlatformAuditEvent, appendSupportTicket, appendTenantHandoff } from "@/lib/platform-workspace-actions";
import { useTenant } from "@/lib/tenant";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";

type ContractStatus = "Draft" | "Awaiting signature" | "Active" | "Renewal due";
type AgreementType = "MSA" | "Order Form" | "DPA" | "SOW";

type ContractRecord = {
  id: string;
  tenantId: string;
  school: string;
  type: AgreementType;
  status: ContractStatus;
  value: number;
  expiresOn: string;
  owner: string;
};

const contractOwners = ["Legal desk", "Revenue ops", "Platform admin"];

function statusTone(status: ContractStatus) {
  if (status === "Active") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (status === "Renewal due") return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
}

export const Route = createFileRoute("/contract-center")({
  head: () => ({ meta: [{ title: "Contract Center - SRMS" }] }),
  component: ContractCenterPage,
});

function ContractCenterPage() {
  const { user } = useAuth();
  const { tenants } = useTenant();
  const { data: workspace } = usePlatformWorkspace();
  const saveWorkspace = useSavePlatformWorkspace();
  const [packDialogOpen, setPackDialogOpen] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const contracts = (workspace?.contracts ?? tenants.flatMap((tenant, index) => ([
    { id: `ctr-${tenant.id}-msa`, tenantId: tenant.id, school: tenant.name, type: "MSA" as AgreementType, status: "Active" as ContractStatus, value: tenant.subscription.amount * 12, expiresOn: tenant.subscription.renewalDate, owner: contractOwners[index % contractOwners.length] },
    { id: `ctr-${tenant.id}-dpa`, tenantId: tenant.id, school: tenant.name, type: "DPA" as AgreementType, status: (index % 2 === 0 ? "Active" : "Awaiting signature") as ContractStatus, value: 0, expiresOn: tenant.subscription.renewalDate, owner: "Legal desk" },
  ])).slice(0, Math.max(6, tenants.length * 2))) as ContractRecord[];

  if (user?.role !== "super_admin") {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <p className="text-lg font-semibold">Access denied</p>
        <p className="text-sm text-muted-foreground">This area is restricted to System Administrators.</p>
        <Button asChild variant="outline"><Link to="/">Go to dashboard</Link></Button>
      </div>
    );
  }

  const stats = useMemo(() => ({
    active: contracts.filter((contract) => contract.status === "Active").length,
    awaitingSignature: contracts.filter((contract) => contract.status === "Awaiting signature").length,
    renewalDue: contracts.filter((contract) => contract.status === "Renewal due").length,
    contractValue: contracts.reduce((sum, contract) => sum + contract.value, 0),
  }), [contracts]);

  const advanceContract = (contractId: string) => {
    const currentContract = contracts.find((item) => item.id === contractId);
    if (!currentContract) return;
    let nextStatus: ContractStatus = currentContract.status;
    const nextContracts = contracts.map((contract) => {
      if (contract.id !== contractId) return contract;
      const status: ContractStatus =
        contract.status === "Draft" ? "Awaiting signature" :
          contract.status === "Awaiting signature" ? "Active" :
            contract.status === "Active" ? "Renewal due" :
              "Active";
      nextStatus = status;
      return { ...contract, status };
    });
    saveWorkspace.mutate({
      contracts: nextContracts,
      ...(nextStatus === "Awaiting signature"
        ? {
          supportTickets: appendSupportTicket(workspace, {
            tenantId: currentContract.tenantId,
            tenantName: currentContract.school,
            subject: `${currentContract.type} signature follow-up required`,
            category: "Commercial",
            priority: "Medium",
            owner: currentContract.owner,
            article: "Renewal and success workflow",
          }),
        }
        : {}),
      ...(nextStatus === "Active"
        ? {
          tenantHandoffs: appendTenantHandoff(workspace, {
            school: currentContract.school,
            owner: "Customer success desk",
            reason: `${currentContract.type} activated; prepare onboarding or renewal handoff`,
            status: "Queued",
          }),
          supportTickets: appendSupportTicket(workspace, {
            tenantId: currentContract.tenantId,
            tenantName: currentContract.school,
            subject: `${currentContract.type} activation handoff`,
            category: "Commercial",
            priority: "Medium",
            owner: "Customer success desk",
            article: "Renewal and success workflow",
          }),
        }
        : {}),
      ...(nextStatus === "Renewal due"
        ? {
          supportTickets: appendSupportTicket(workspace, {
            tenantId: currentContract.tenantId,
            tenantName: currentContract.school,
            subject: `${currentContract.type} renewal follow-up required`,
            category: "Commercial",
            priority: "Medium",
            owner: currentContract.owner,
            article: "Renewal and success workflow",
          }),
          approvalItems: appendApprovalItem(workspace, {
            type: "Commercial",
            requester: currentContract.owner,
            school: currentContract.school,
            summary: `Review renewal terms for ${currentContract.type} (${currentContract.id})`,
          }),
        }
        : {}),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: currentContract.school,
        area: "Billing",
        severity: nextStatus === "Renewal due" ? "Warning" : "Info",
        action: `Moved contract ${currentContract.id} from ${currentContract.status} to ${nextStatus}`,
      }),
    });
    toast.success("Contract status updated");
  };

  const generateContractPack = () => {
    const now = new Date().toLocaleString();
    saveWorkspace.mutate({
      exportJobs: appendExportJob(workspace, {
        school: "Platform",
        scope: "Contract pack bundle",
        requestedBy: user?.name ?? "System Administrator",
      }),
      supportTickets: appendSupportTicket(workspace, {
        tenantId: "platform-legal",
        tenantName: "Platform legal",
        subject: "Review generated cross-tenant contract bundle",
        category: "Commercial",
        priority: "Medium",
        owner: "Legal desk",
        article: "Renewal and success workflow",
      }),
      approvalItems: appendApprovalItem(workspace, {
        type: "Legal",
        requester: user?.name ?? "System Administrator",
        school: "Platform",
        summary: "Approve updated cross-tenant contract pack before distribution",
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        action: "Generated cross-tenant contract pack",
      }),
    });
    setGeneratedAt(now);
    setPackDialogOpen(true);
  };

  return (
    <>
    <div className="space-y-6">
      <PageHeader
        title="Contract Center"
        description="Manage master agreements, DPAs, order forms, renewals, and signature readiness across the school portfolio."
        actions={(
          <>
            <Button variant="outline" asChild>
              <Link to="/revenue-ops">Open revenue ops</Link>
            </Button>
            <Button onClick={generateContractPack}>
              <FileSignature className="mr-2 h-4 w-4" />
              Generate contract pack
            </Button>
          </>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active agreements" value={stats.active} accent="success" icon={<ShieldCheck className="h-4 w-4" />} />
        <StatCard label="Awaiting signature" value={stats.awaitingSignature} accent="primary" icon={<FileSignature className="h-4 w-4" />} />
        <StatCard label="Renewal due" value={stats.renewalDue} accent="warning" icon={<BadgeCheck className="h-4 w-4" />} />
        <StatCard label="Annual contract value" value={`K${stats.contractValue.toLocaleString()}`} accent="accent" icon={<Wallet className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="agreements" className="space-y-4">
        <TabsList>
          <TabsTrigger value="agreements">Agreements</TabsTrigger>
          <TabsTrigger value="renewals">Renewals</TabsTrigger>
          <TabsTrigger value="compliance">Compliance docs</TabsTrigger>
        </TabsList>

        <TabsContent value="agreements" className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead>Agreement</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Advance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell>{contract.school}</TableCell>
                  <TableCell>{contract.type}</TableCell>
                  <TableCell>{contract.owner}</TableCell>
                  <TableCell>{contract.value > 0 ? `K${contract.value.toLocaleString()}` : "Included"}</TableCell>
                  <TableCell>{contract.expiresOn}</TableCell>
                  <TableCell><Badge className={statusTone(contract.status)}>{contract.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => advanceContract(contract.id)}>
                      Advance
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="renewals" className="grid gap-4 lg:grid-cols-3">
          {contracts.filter((contract) => contract.type === "MSA" || contract.status === "Renewal due").slice(0, 6).map((contract) => (
            <div key={contract.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{contract.school}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{contract.type} · {contract.owner}</p>
                </div>
                <Badge className={statusTone(contract.status)}>{contract.status}</Badge>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Expiry</span>
                  <span>{contract.expiresOn}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Value</span>
                  <span>{contract.value > 0 ? `K${contract.value.toLocaleString()}` : "Included"}</span>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => advanceContract(contract.id)}>Update status</Button>
                <Button size="sm" asChild>
                  <Link to="/tenant-success">Open success</Link>
                </Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="compliance" className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold">Document readiness</p>
            <div className="mt-4 space-y-3">
              {[
                "Data Processing Agreement",
                "Master Services Agreement",
                "Security and availability schedule",
                "Implementation statement of work",
              ].map((item) => (
                <div key={item} className="flex items-center justify-between rounded-lg border border-border p-4">
                  <span>{item}</span>
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Ready</Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold">Cross-links</p>
            <div className="mt-4 space-y-3">
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link to="/data-governance">Open data governance</Link>
              </Button>
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link to="/plan-catalog">Open plan catalog</Link>
              </Button>
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link to="/partner-management">Open partner management</Link>
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>

    {/* Contract pack preview dialog */}
    <Dialog open={packDialogOpen} onOpenChange={setPackDialogOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-base">Contract pack generated</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Generated {generatedAt} · Submitted to Legal desk for review</p>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <p className="text-xl font-bold">{contracts.length}</p>
            <p className="text-xs text-muted-foreground">Contracts included</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <p className="text-xl font-bold">{tenants.length}</p>
            <p className="text-xs text-muted-foreground">Schools covered</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <p className="text-xl font-bold">K{stats.contractValue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total annual value</p>
          </div>
        </div>

        {/* Contract list */}
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Documents in this pack</p>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">School</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Type</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Owner</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contracts.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2 px-3 font-medium">{c.school}</td>
                    <td className="py-2 px-3 text-muted-foreground">{c.type}</td>
                    <td className="py-2 px-3 text-muted-foreground">{c.owner}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusTone(c.status)}`}>{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Standard compliance docs */}
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Platform compliance attachments</p>
          <div className="space-y-1.5">
            {["Data Processing Agreement (template)", "Master Services Agreement (template)", "Security & Availability Schedule", "Implementation Statement of Work"].map((doc) => (
              <div key={doc} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-sm">{doc}</span>
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs">Included</Badge>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">An approval request and support ticket have been created for Legal desk review.</p>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => { setPackDialogOpen(false); toast.info("Pack saved to export jobs"); }}>
              <X className="mr-1.5 h-3.5 w-3.5" /> Close
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-3.5 w-3.5" /> Print / Save PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
