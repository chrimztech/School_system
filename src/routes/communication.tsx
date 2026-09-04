import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { Send, MessageSquare, Phone, Loader2, Plus, ChevronDown, ChevronUp, CheckCheck, X, Trash2, Pencil, Megaphone, Radio, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader, StatCard } from "@/components/page-header";
import { Button, Chip, IconButton, MenuItem, TextField, Dialog, DialogContent, DialogActions, DialogTitle, Tabs, Tab } from "@mui/material";
import { badgeSx } from "@/lib/utils";
import { useTenant, gradeFormLabels } from "@/lib/tenant";
import { isSchoolLeadershipRole, useAuth } from "@/lib/auth";
import { useNotifications } from "@/lib/notifications";
import { api } from "@/lib/api";

export const Route = createFileRoute("/communication")({
  head: () => ({ meta: [{ title: "Communication - SRMS" }] }),
  component: CommunicationPage,
});

// WhatsApp sending isn't wired up yet — it needs Meta Business verification and pre-approved
// message templates that can't happen from this app's config alone (see the school-settings
// WhatsApp number field). Show it as a real option so it's visible/plannable, but disabled, so
// nobody picks it believing a message will actually go out.
const CHANNEL_OPTIONS: { id: string; disabled?: boolean }[] = [
  { id: "SMS" },
  { id: "WhatsApp", disabled: true },
  { id: "Email" },
  { id: "USSD" },
];

function audiencesForType(type: any): string[] {
  const base = ["All", "All parents", "All staff", "All alumni"];
  const showPrimary = ["PRIMARY", "COMBINED", "FULL", "NURSERY"].includes(type);
  const showSecondary = ["SECONDARY", "COMBINED", "FULL"].includes(type);
  const grades = gradeFormLabels(type);
  return [
    ...base,
    ...(showSecondary ? ["All secondary", ...grades.filter((g) => g.startsWith("Form"))] : []),
    ...(showPrimary ? ["All primary", ...grades.filter((g) => g.startsWith("Grade"))] : []),
  ];
}

function statusVariant(status: string) {
  const s = status?.toUpperCase();
  if (s === "OPEN") return "destructive";
  if (s === "REPLIED") return "secondary";
  return "outline";
}

function statusLabel(status: string) {
  const s = status?.toUpperCase();
  if (s === "OPEN") return "Open";
  if (s === "REPLIED") return "Replied";
  if (s === "CLOSED") return "Closed";
  return status;
}

function CommunicationPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const { user, isSystemAdmin } = useAuth();
  // Creating announcements/broadcasts is a privileged sub-capability of the Communication
  // module, distinct from just having access to it — restricted to school leadership so
  // teachers, HODs, parents, finance, and career guidance (all of whom can read/reply to
  // messages) can't also mass-broadcast to the whole school.
  const canCreateAnnouncements = isSchoolLeadershipRole(user?.role);
  const qc = useQueryClient();
  const { push } = useNotifications();

  const hash = useRouterState({ select: (s) => s.location.hash });
  const [tab, setTab] = useState("messages");

  // Reply dialog
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState<any>(null);
  const [replyText, setReplyText] = useState("");

  // Expanded message bodies in the list
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Broadcast form
  const [broadcastRecipients, setBroadcastRecipients] = useState("All parents");
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastChannels, setBroadcastChannels] = useState<string[]>(["SMS"]);
  const [broadcastPriority, setBroadcastPriority] = useState("Normal");
  const [broadcastScheduled, setBroadcastScheduled] = useState("");
  const [broadcastLanguage, setBroadcastLanguage] = useState("English");
  const [broadcastRequireAck, setBroadcastRequireAck] = useState("no");

  // Announcement dialog
  const [annoOpen, setAnnoOpen] = useState(false);
  const [annoForm, setAnnoForm] = useState({ title: "", body: "", audience: "All" });
  const [annoChannels, setAnnoChannels] = useState<string[]>(["SMS"]);
  const [annoPriority, setAnnoPriority] = useState("Normal");
  const [editingAnnId, setEditingAnnId] = useState<string | null>(null);

  useEffect(() => {
    const next = hash === "#broadcast" || hash === "broadcast" ? "broadcast"
      : hash === "#announcements" || hash === "announcements" ? "announcements"
      : null;
    if (next) setTab(next);
  }, [hash]);

  const { data: messages = [], isLoading: msgsLoading } = useQuery({
    queryKey: ["messages", schoolId],
    queryFn: () => api.communication.messages(schoolId),
  });

  const { data: announcements = [], isLoading: annoLoading } = useQuery({
    queryKey: ["announcements", schoolId],
    queryFn: () => api.communication.announcements(schoolId),
  });

  // Super-admin only — the Zamtel account is one platform-wide credit pool shared across every
  // school, not a per-school resource, so it's meaningless (and misleading) to show a single
  // school's admins "the" SMS balance. Also only fetched once the broadcast tab is open with
  // SMS actually selected — no point checking credit for an email/WhatsApp-only send.
  const { data: smsBalance } = useQuery({
    queryKey: ["sms-balance", schoolId],
    queryFn: () => api.communication.smsBalance(schoolId),
    enabled: isSystemAdmin && tab === "broadcast" && broadcastChannels.includes("SMS"),
    staleTime: 30_000,
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api.communication.replyMessage(schoolId, id, { replyBody: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", schoolId] });
      toast.success(`Reply sent to ${replyTarget?.senderName ?? replyTarget?.parent}`);
      setReplyOpen(false);
      setReplyText("");
    },
    onError: () => toast.error("Failed to send reply"),
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => api.communication.closeMessage(schoolId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", schoolId] });
      toast.success("Message marked as resolved");
    },
    onError: () => toast.error("Failed to close message"),
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: (data: any) => api.communication.createAnnouncement(schoolId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements", schoolId] });
      toast.success("Announcement published");
      push({ title: "Announcement published", body: annoForm.title, module: "Communication", severity: "info" });
      setAnnoForm({ title: "", body: "", audience: "All" });
      setAnnoChannels(["SMS"]);
      setAnnoPriority("Normal");
      setAnnoOpen(false);
    },
    onError: () => toast.error("Failed to publish announcement"),
  });

  const updateAnnouncementMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.communication.updateAnnouncement(schoolId, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements", schoolId] });
      toast.success("Announcement updated");
      setEditingAnnId(null);
      setAnnoOpen(false);
    },
    onError: () => toast.error("Failed to update announcement"),
  });

  const deleteAnnouncementMutation = useMutation({
    mutationFn: (id: string) => api.communication.deleteAnnouncement(schoolId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements", schoolId] });
      toast.success("Announcement deleted");
    },
    onError: () => toast.error("Failed to delete announcement"),
  });

  const broadcastMutation = useMutation({
    mutationFn: (data: any) => api.communication.createAnnouncement(schoolId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements", schoolId] });
      const summary = broadcastScheduled
        ? `Broadcast scheduled for ${new Date(broadcastScheduled).toLocaleString()} · ${broadcastChannels.join(", ")} → ${broadcastRecipients}`
        : `Broadcast sent via ${broadcastChannels.join(", ")} to ${broadcastRecipients}`;
      toast.success(summary);
      push({ title: broadcastScheduled ? "Broadcast scheduled" : "Broadcast sent", body: summary, module: "Communication", severity: "info" });
      setBroadcastSubject("");
      setBroadcastBody("");
      setBroadcastScheduled("");
    },
    onError: () => toast.error("Failed to send broadcast"),
  });

  const toggleExpand = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const openReply = (message: any) => {
    setReplyTarget(message);
    setReplyText("");
    setReplyOpen(true);
  };

  const sendReply = () => {
    if (!replyText.trim()) { toast.error("Reply cannot be empty"); return; }
    replyMutation.mutate({ id: replyTarget.id, body: replyText.trim() });
  };

  const createAnnouncement = () => {
    if (!annoForm.title.trim() || !annoForm.body.trim()) { toast.error("Title and message are required"); return; }
    if (annoChannels.length === 0) { toast.error("Select at least one channel"); return; }
    if (editingAnnId) {
      updateAnnouncementMutation.mutate({
        id: editingAnnId,
        data: {
          title: annoForm.title.trim(),
          body: annoForm.body.trim(),
          audience: annoForm.audience,
          channels: annoChannels.join(", "),
          priority: annoPriority,
        },
      });
      return;
    }
    createAnnouncementMutation.mutate({
      title: annoForm.title.trim(),
      body: annoForm.body.trim(),
      audience: annoForm.audience,
      channels: annoChannels.join(", "),
      priority: annoPriority,
      publishDate: new Date().toISOString().slice(0, 10),
      createdBy: user?.name ?? user?.email ?? "Staff",
      active: true,
    });
  };

  const openEditAnnouncement = (ann: any) => {
    setEditingAnnId(ann.id);
    setAnnoForm({ title: ann.title ?? "", body: ann.body ?? "", audience: ann.audience ?? "All" });
    const channelList: string[] = typeof ann.channels === "string"
      ? ann.channels.split(",").map((c: string) => c.trim()).filter(Boolean)
      : ann.channels ?? ["SMS"];
    setAnnoChannels(channelList);
    setAnnoPriority(ann.priority ?? "Normal");
    setAnnoOpen(true);
  };

  const toggleChannel = (channel: string) =>
    setBroadcastChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );

  const toggleAnnoChannel = (channel: string) =>
    setAnnoChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );

  const sendBroadcast = () => {
    if (!broadcastSubject.trim() || !broadcastBody.trim()) { toast.error("Subject and message are required"); return; }
    if (broadcastChannels.length === 0) { toast.error("Select at least one channel"); return; }
    broadcastMutation.mutate({
      title: broadcastSubject.trim(),
      body: broadcastBody.trim(),
      audience: broadcastRecipients,
      channels: broadcastChannels.join(", "),
      publishDate: broadcastScheduled ? broadcastScheduled.slice(0, 10) : new Date().toISOString().slice(0, 10),
      scheduledAt: broadcastScheduled || null,
      priority: broadcastPriority,
      language: broadcastLanguage,
      requireAck: broadcastRequireAck === "yes",
      createdBy: user?.name ?? user?.email ?? "Staff",
      active: true,
    });
  };

  const msgList = messages as any[];
  const annoList = announcements as any[];
  const openCount = msgList.filter((m) => m.status?.toUpperCase() === "OPEN").length;
  const urgentCount = annoList.filter((a) => a.priority === "Urgent" || a.priority === "Emergency").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communication"
        description="SMS · WhatsApp · Email · USSD fallback for parents without smartphones"
        actions={
          canCreateAnnouncements && (
            <Button variant="contained" onClick={() => setTab("broadcast")} startIcon={<Send className="h-4 w-4" />}>New broadcast</Button>
          )
        }
      />

      {isSystemAdmin && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Everything on this page — messages, announcements, and broadcasts — applies to{" "}
          <strong>{active.name}</strong> only, not all schools. Switch schools from the sidebar's{" "}
          <strong>Portfolio control</strong> switcher before sending if you meant to reach a different school's parents.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Open parent messages"
          value={openCount}
          accent={openCount > 0 ? "destructive" : "success"}
          icon={<MessageSquare className="h-4 w-4" />}
        />
        <StatCard label="Total messages" value={msgList.length} accent="primary" icon={<Radio className="h-4 w-4" />} />
        <StatCard label="Announcements published" value={annoList.length} accent="accent" icon={<Megaphone className="h-4 w-4" />} />
        <StatCard
          label="Urgent / emergency active"
          value={urgentCount}
          accent={urgentCount > 0 ? "warning" : "success"}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab
          value="messages"
          icon={<MessageSquare className="h-4 w-4" />}
          iconPosition="start"
          label={
            <span className="flex items-center gap-1.5">
              Parent messages
              {openCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                  {openCount}
                </span>
              )}
            </span>
          }
        />
        <Tab value="announcements" label="Announcements" />
        {canCreateAnnouncements && <Tab value="broadcast" label="Send broadcast" />}
      </Tabs>

      {/* ── Messages tab ─────────────────────────────────────────── */}
      {tab === "messages" && (
        <div className="mt-4 space-y-2">
          {msgsLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading messages…</span>
            </div>
          ) : msgList.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            msgList.map((msg: any) => {
              const expanded = expandedIds.has(msg.id);
              const isClosed = msg.status?.toUpperCase() === "CLOSED";
              return (
                <div key={msg.id} className={`rounded-xl border border-border bg-card shadow-sm transition-opacity ${isClosed ? "opacity-60" : ""}`}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{msg.subject}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          From <span className="font-medium">{msg.senderName ?? msg.parent}</span>
                          {(msg.studentName ?? msg.student) && <> · re: {msg.studentName ?? msg.student}</>}
                          <span className="ml-2">{(msg.sentAt ?? msg.createdAt ?? msg.date ?? "").slice(0, 10)}</span>
                        </p>
                      </div>
                      <Chip size="small" label={statusLabel(msg.status)} sx={badgeSx(statusVariant(msg.status))} />
                    </div>

                    {/* Expandable body */}
                    {msg.body && (
                      <button
                        className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => toggleExpand(msg.id)}
                      >
                        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {expanded ? "Hide message" : "Read message"}
                      </button>
                    )}
                    {expanded && msg.body && (
                      <p className="mt-2 rounded-lg bg-muted/40 px-3 py-2 text-sm text-foreground whitespace-pre-wrap">{msg.body}</p>
                    )}

                    {/* Reply body (if already replied) */}
                    {msg.replyBody && (
                      <div className="mt-2 rounded-lg border-l-2 border-primary/40 bg-primary/5 px-3 py-2">
                        <p className="text-[11px] font-semibold text-primary/70 uppercase tracking-wide mb-1">Your reply</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{msg.replyBody}</p>
                      </div>
                    )}

                    <div className="mt-3 flex items-center gap-2">
                      {!isClosed && (
                        <>
                          <Button size="small" variant="outlined" onClick={() => openReply(msg)}>
                            Reply
                          </Button>
                          <Button
                            size="small"
                            variant="text"
                            color="inherit"
                            onClick={() => closeMutation.mutate(msg.id)}
                            disabled={closeMutation.isPending}
                            startIcon={<CheckCheck className="h-3.5 w-3.5" />}
                          >
                            Mark resolved
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Announcements tab ────────────────────────────────────── */}
      {tab === "announcements" && (
        <div className="mt-4 space-y-3">
          <div className="flex justify-end">
            {canCreateAnnouncements && (
              <>
                <Button variant="contained" size="small" startIcon={<Plus className="h-4 w-4" />} onClick={() => { setEditingAnnId(null); setAnnoForm({ title: "", body: "", audience: "All" }); setAnnoChannels(["SMS"]); setAnnoPriority("Normal"); setAnnoOpen(true); }}>New announcement</Button>
                <Dialog open={annoOpen} onClose={() => setAnnoOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editingAnnId ? "Edit announcement" : "Create announcement"}</DialogTitle>
                <DialogContent>
                  <div className="grid gap-3">
                    <TextField
                      label="Title *"
                      value={annoForm.title}
                      onChange={(e) => setAnnoForm({ ...annoForm, title: e.target.value })}
                      placeholder="Term 2 exam timetable released"
                      slotProps={{ htmlInput: { maxLength: 120 } }}
                      fullWidth
                      size="small"
                    />
                    <TextField
                      select
                      label="Audience"
                      value={annoForm.audience}
                      onChange={(e) => setAnnoForm({ ...annoForm, audience: e.target.value })}
                      fullWidth
                      size="small"
                    >
                      {audiencesForType(active.type).map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                    </TextField>
                    <TextField
                      select
                      label="Priority"
                      value={annoPriority}
                      onChange={(e) => setAnnoPriority(e.target.value)}
                      helperText="Urgent/Emergency lead the SMS with the severity word and add an urgent-notice banner to the email"
                      fullWidth
                      size="small"
                    >
                      {["Normal", "Urgent", "Emergency"].map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                    </TextField>
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Channels</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {CHANNEL_OPTIONS.map(({ id: ch, disabled }) => (
                          <button
                            key={ch}
                            type="button"
                            disabled={disabled}
                            onClick={() => toggleAnnoChannel(ch)}
                            title={disabled ? "WhatsApp isn't connected yet — messages on this channel won't send" : undefined}
                          >
                            <Chip
                              size="small"
                              icon={ch === "USSD" ? <Phone size={12} /> : undefined}
                              label={disabled ? `${ch} (soon)` : ch}
                              sx={{ ...badgeSx(annoChannels.includes(ch) ? "secondary" : "outline"), cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}
                            />
                          </button>
                        ))}
                      </div>
                      {annoChannels.length === 0 && (
                        <p className="mt-1 text-xs text-destructive">Select at least one channel</p>
                      )}
                    </div>
                    <TextField
                      label="Message *"
                      multiline
                      minRows={4}
                      value={annoForm.body}
                      onChange={(e) => setAnnoForm({ ...annoForm, body: e.target.value })}
                      placeholder="Dear parents / staff..."
                      fullWidth
                      size="small"
                    />
                  </div>
                </DialogContent>
                <DialogActions>
                  <Button variant="outlined" color="inherit" onClick={() => setAnnoOpen(false)}>Cancel</Button>
                  <Button variant="contained" onClick={createAnnouncement} disabled={createAnnouncementMutation.isPending || updateAnnouncementMutation.isPending || annoChannels.length === 0}>
                    {(createAnnouncementMutation.isPending || updateAnnouncementMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingAnnId ? "Save changes" : "Publish"}
                  </Button>
                </DialogActions>
                </Dialog>
              </>
            )}
          </div>

          {annoLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading announcements…</span>
            </div>
          ) : annoList.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No announcements yet.</p>
          ) : (
            annoList.map((ann: any) => {
              const channelList: string[] =
                typeof ann.channels === "string"
                  ? ann.channels.split(",").map((c: string) => c.trim()).filter(Boolean)
                  : ann.channels ?? [];
              const priorityBorder = ann.priority === "Emergency"
                ? "border-l-4 border-l-destructive"
                : ann.priority === "Urgent"
                  ? "border-l-4 border-l-amber-500"
                  : "";
              return (
                <div key={ann.id} className={`rounded-xl border border-border bg-card p-4 shadow-sm ${priorityBorder}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{ann.title}</p>
                        {ann.priority && ann.priority !== "Normal" && (
                          <Chip
                            size="small"
                            label={ann.priority}
                            sx={{ ...badgeSx(ann.priority === "Emergency" ? "destructive" : "warning"), fontSize: 12 }}
                          />
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{ann.body}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {ann.audience && <span>→ {ann.audience}</span>}
                        {ann.createdBy && <span>by {ann.createdBy}</span>}
                        <span>{(ann.publishDate ?? ann.createdAt ?? "").slice(0, 10)}</span>
                        {ann.scheduledAt && <span className="text-amber-600">Scheduled</span>}
                        {ann.requireAck && <span className="text-blue-600">Ack required</span>}
                      </div>
                    </div>
                    {canCreateAnnouncements && (
                      <div className="flex flex-shrink-0 items-center gap-1">
                        <IconButton
                          size="small"
                          aria-label="Edit announcement"
                          sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }}
                          onClick={() => openEditAnnouncement(ann)}
                        >
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label="Delete announcement"
                          sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
                          onClick={() => deleteAnnouncementMutation.mutate(ann.id)}
                          disabled={deleteAnnouncementMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </div>
                    )}
                  </div>
                  {channelList.length > 0 && (
                    <div className="mt-3 flex gap-1 flex-wrap">
                      {channelList.map((c) => <Chip key={c} size="small" label={c} sx={badgeSx("outline")} />)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Broadcast tab ────────────────────────────────────────── */}
      {tab === "broadcast" && (
        <div className="mt-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 border-b border-border pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Megaphone className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Compose broadcast</p>
                <p className="text-xs text-muted-foreground">Sends immediately, or schedules for later</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  select
                  label="Recipients *"
                  value={broadcastRecipients}
                  onChange={(e) => setBroadcastRecipients(e.target.value)}
                  fullWidth
                  size="small"
                >
                  {["All parents", "Form 1 parents", "Form 2 parents", "Form 3 parents", "Form 4 parents", "Form 5 parents", "Form 6 parents", "All primary parents", "All staff", "All alumni"].map((r) => (
                    <MenuItem key={r} value={r}>{r}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Priority"
                  value={broadcastPriority}
                  onChange={(e) => setBroadcastPriority(e.target.value)}
                  fullWidth
                  size="small"
                >
                  {["Normal", "Urgent", "Emergency"].map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                </TextField>
              </div>

              <TextField
                label="Subject *"
                value={broadcastSubject}
                onChange={(e) => setBroadcastSubject(e.target.value)}
                placeholder="Term 2 Mid-Term Exams"
                slotProps={{ htmlInput: { maxLength: 120 } }}
                fullWidth
                size="small"
              />

              <div>
                <TextField
                  label="Message *"
                  multiline
                  minRows={5}
                  value={broadcastBody}
                  onChange={(e) => setBroadcastBody(e.target.value)}
                  placeholder="Dear parent / guardian, ..."
                  fullWidth
                  size="small"
                />
                <p className="mt-1 text-xs text-muted-foreground text-right">{broadcastBody.length} chars</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  type="datetime-local"
                  label="Schedule send (optional)"
                  value={broadcastScheduled}
                  onChange={(e) => setBroadcastScheduled(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                  size="small"
                />
                <TextField
                  select
                  label="Language"
                  value={broadcastLanguage}
                  onChange={(e) => setBroadcastLanguage(e.target.value)}
                  fullWidth
                  size="small"
                >
                  {["English", "Nyanja", "Bemba", "Tonga", "Lozi"].map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                </TextField>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Channels</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CHANNEL_OPTIONS.map(({ id: ch, disabled }) => (
                    <button
                      key={ch}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleChannel(ch)}
                      title={disabled ? "WhatsApp isn't connected yet — messages on this channel won't send" : undefined}
                    >
                      <Chip
                        size="small"
                        icon={ch === "USSD" ? <Phone size={12} /> : undefined}
                        label={disabled ? `${ch} (soon)` : ch}
                        sx={{ ...badgeSx(broadcastChannels.includes(ch) ? "secondary" : "outline"), cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}
                      />
                    </button>
                  ))}
                </div>
                {broadcastChannels.length === 0 && (
                  <p className="mt-1 text-xs text-destructive">Select at least one channel</p>
                )}
                {broadcastChannels.includes("SMS") && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Recipients will see it sent from{" "}
                    <span className="font-medium text-foreground">
                      {active.smsSenderId || "the platform default sender ID"}
                    </span>
                    {!active.smsSenderId && " — ask a platform admin to register this school's own sender ID in Settings for that to show your school's name instead"}.
                  </p>
                )}
                {broadcastChannels.includes("SMS") && smsBalance !== undefined && (
                  smsBalance < 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      SMS balance unavailable — Zamtel BulkSMS isn't configured or is unreachable.
                    </p>
                  ) : (
                    <p className={`mt-1 text-xs ${smsBalance < 50 ? "text-destructive" : "text-muted-foreground"}`}>
                      SMS balance: {smsBalance.toLocaleString()} credit{smsBalance === 1 ? "" : "s"}
                    </p>
                  )
                )}
              </div>

              <TextField
                select
                label="Require read acknowledgement"
                value={broadcastRequireAck}
                onChange={(e) => setBroadcastRequireAck(e.target.value)}
                fullWidth
                size="small"
              >
                <MenuItem value="no">No — standard send</MenuItem>
                <MenuItem value="yes">Yes — track read receipts</MenuItem>
              </TextField>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="contained"
                  onClick={sendBroadcast}
                  disabled={broadcastMutation.isPending || broadcastChannels.length === 0}
                  startIcon={broadcastMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                >
                  {broadcastScheduled ? "Schedule broadcast" : `Send to ${broadcastRecipients}`}
                </Button>
                {broadcastScheduled && (
                  <p className="text-xs text-muted-foreground">
                    Will send on {new Date(broadcastScheduled).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Reply dialog ─────────────────────────────────────────────── */}
      <Dialog open={replyOpen} onClose={() => { setReplyOpen(false); setReplyTarget(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>Reply to {replyTarget?.senderName ?? replyTarget?.parent}</DialogTitle>
        <DialogContent>
          {/* Original message context */}
          <div className="rounded-lg bg-muted/40 px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {replyTarget?.subject}
            </p>
            {replyTarget?.studentName && (
              <p className="text-xs text-muted-foreground">Re: {replyTarget.studentName}</p>
            )}
            {replyTarget?.body && (
              <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{replyTarget.body}</p>
            )}
          </div>

          <TextField
            multiline
            minRows={4}
            placeholder="Type your reply…"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            autoFocus
            fullWidth
            size="small"
          />
          <p className="text-xs text-muted-foreground text-right">{replyText.length} chars</p>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setReplyOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={sendReply}
            disabled={replyMutation.isPending || !replyText.trim()}
            startIcon={replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          >
            Send reply
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
