import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { Send, MessageSquare, Phone, Loader2, Plus, ChevronDown, ChevronUp, CheckCheck, X, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useTenant } from "@/lib/tenant";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/communication")({
  head: () => ({ meta: [{ title: "Communication - SRMS" }] }),
  component: CommunicationPage,
});

const AUDIENCES = [
  "All", "All parents", "All staff", "All alumni", "All secondary",
  "Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Form 6",
  "All primary", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6",
];

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
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";
  const isHOD = user?.role === "hod";
  const qc = useQueryClient();

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
  const [broadcastChannels, setBroadcastChannels] = useState<string[]>(["SMS", "WhatsApp"]);
  const [broadcastPriority, setBroadcastPriority] = useState("Normal");
  const [broadcastScheduled, setBroadcastScheduled] = useState("");
  const [broadcastLanguage, setBroadcastLanguage] = useState("English");
  const [broadcastRequireAck, setBroadcastRequireAck] = useState("no");

  // Announcement dialog
  const [annoOpen, setAnnoOpen] = useState(false);
  const [annoForm, setAnnoForm] = useState({ title: "", body: "", audience: "All", channels: "SMS, WhatsApp" });

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
      setAnnoForm({ title: "", body: "", audience: "All", channels: "SMS, WhatsApp" });
      setAnnoOpen(false);
    },
    onError: () => toast.error("Failed to publish announcement"),
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
      toast.success(
        broadcastScheduled
          ? `Broadcast scheduled for ${new Date(broadcastScheduled).toLocaleString()} · ${broadcastChannels.join(", ")} → ${broadcastRecipients}`
          : `Broadcast sent via ${broadcastChannels.join(", ")} to ${broadcastRecipients}`
      );
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
    createAnnouncementMutation.mutate({
      title: annoForm.title.trim(),
      body: annoForm.body.trim(),
      audience: annoForm.audience,
      channels: annoForm.channels.trim() || null,
      publishDate: new Date().toISOString().slice(0, 10),
      createdBy: user?.name ?? user?.email ?? "Staff",
      active: true,
    });
  };

  const toggleChannel = (channel: string) =>
    setBroadcastChannels((prev) =>
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communication"
        description="SMS · WhatsApp · Email · USSD fallback for parents without smartphones"
        actions={
          !isTeacher && !isHOD && (
            <Button onClick={() => setTab("broadcast")}>
              <Send className="mr-2 h-4 w-4" />New broadcast
            </Button>
          )
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="messages" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Parent messages
            {openCount > 0 && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                {openCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          {!isTeacher && !isHOD && <TabsTrigger value="broadcast">Send broadcast</TabsTrigger>}
        </TabsList>

        {/* ── Messages tab ─────────────────────────────────────────── */}
        <TabsContent value="messages" className="mt-4 space-y-2">
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
                      <Badge variant={statusVariant(msg.status)}>{statusLabel(msg.status)}</Badge>
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
                          <Button size="sm" variant="outline" onClick={() => openReply(msg)}>
                            Reply
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground"
                            onClick={() => closeMutation.mutate(msg.id)}
                            disabled={closeMutation.isPending}
                          >
                            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />Mark resolved
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* ── Announcements tab ────────────────────────────────────── */}
        <TabsContent value="announcements" className="mt-4 space-y-3">
          <div className="flex justify-end">
            {!isTeacher && !isHOD && (
              <Dialog open={annoOpen} onOpenChange={setAnnoOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-1 h-4 w-4" />New announcement</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader><DialogTitle>Create announcement</DialogTitle></DialogHeader>
                  <div className="grid gap-3">
                    <div>
                      <Label>Title *</Label>
                      <Input className="mt-1" value={annoForm.title} onChange={(e) => setAnnoForm({ ...annoForm, title: e.target.value })} placeholder="Term 2 exam timetable released" maxLength={120} />
                    </div>
                    <div>
                      <Label>Audience</Label>
                      <Select value={annoForm.audience} onValueChange={(v) => setAnnoForm({ ...annoForm, audience: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AUDIENCES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Channels</Label>
                      <Input className="mt-1" value={annoForm.channels} onChange={(e) => setAnnoForm({ ...annoForm, channels: e.target.value })} placeholder="SMS, WhatsApp, Email" maxLength={80} />
                    </div>
                    <div>
                      <Label>Message *</Label>
                      <Textarea className="mt-1" rows={4} value={annoForm.body} onChange={(e) => setAnnoForm({ ...annoForm, body: e.target.value })} placeholder="Dear parents / staff..." />
                    </div>
                  </div>
                  <DialogFooter className="mt-2">
                    <Button variant="outline" onClick={() => setAnnoOpen(false)}>Cancel</Button>
                    <Button onClick={createAnnouncement} disabled={createAnnouncementMutation.isPending}>
                      {createAnnouncementMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Publish
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
              return (
                <div key={ann.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{ann.title}</p>
                        {ann.priority && ann.priority !== "Normal" && (
                          <Badge variant={ann.priority === "Emergency" ? "destructive" : "secondary"} className="text-xs">
                            {ann.priority}
                          </Badge>
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
                    {!isTeacher && !isHOD && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => deleteAnnouncementMutation.mutate(ann.id)}
                        disabled={deleteAnnouncementMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {channelList.length > 0 && (
                    <div className="mt-3 flex gap-1 flex-wrap">
                      {channelList.map((c) => <Badge key={c} variant="outline">{c}</Badge>)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </TabsContent>

        {/* ── Broadcast tab ────────────────────────────────────────── */}
        <TabsContent value="broadcast" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs font-medium uppercase text-muted-foreground">Recipients *</Label>
                  <Select value={broadcastRecipients} onValueChange={setBroadcastRecipients}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["All parents", "Form 1 parents", "Form 2 parents", "Form 3 parents", "Form 4 parents", "Form 5 parents", "Form 6 parents", "All primary parents", "All staff", "All alumni"].map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium uppercase text-muted-foreground">Priority</Label>
                  <Select value={broadcastPriority} onValueChange={setBroadcastPriority}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Normal", "Urgent", "Emergency"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium uppercase text-muted-foreground">Subject *</Label>
                <Input className="mt-1" value={broadcastSubject} onChange={(e) => setBroadcastSubject(e.target.value)} placeholder="Term 2 Mid-Term Exams" maxLength={120} />
              </div>

              <div>
                <Label className="text-xs font-medium uppercase text-muted-foreground">Message *</Label>
                <Textarea className="mt-1" rows={5} value={broadcastBody} onChange={(e) => setBroadcastBody(e.target.value)} placeholder="Dear parent / guardian, ..." />
                <p className="mt-1 text-xs text-muted-foreground text-right">{broadcastBody.length} chars</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs font-medium uppercase text-muted-foreground">Schedule send (optional)</Label>
                  <Input type="datetime-local" className="mt-1" value={broadcastScheduled} onChange={(e) => setBroadcastScheduled(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-medium uppercase text-muted-foreground">Language</Label>
                  <Select value={broadcastLanguage} onValueChange={setBroadcastLanguage}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["English", "Nyanja", "Bemba", "Tonga", "Lozi"].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium uppercase text-muted-foreground">Channels</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["SMS", "WhatsApp", "Email", "USSD"].map((ch) => (
                    <button key={ch} type="button" onClick={() => toggleChannel(ch)}>
                      <Badge variant={broadcastChannels.includes(ch) ? "secondary" : "outline"} className="cursor-pointer">
                        {ch === "USSD" && <Phone className="mr-1 h-3 w-3" />}{ch}
                      </Badge>
                    </button>
                  ))}
                </div>
                {broadcastChannels.length === 0 && (
                  <p className="mt-1 text-xs text-destructive">Select at least one channel</p>
                )}
              </div>

              <div>
                <Label className="text-xs font-medium uppercase text-muted-foreground">Require read acknowledgement</Label>
                <Select value={broadcastRequireAck} onValueChange={setBroadcastRequireAck}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No — standard send</SelectItem>
                    <SelectItem value="yes">Yes — track read receipts</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  className="sm:w-auto"
                  onClick={sendBroadcast}
                  disabled={broadcastMutation.isPending || broadcastChannels.length === 0}
                >
                  {broadcastMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Send className="mr-2 h-4 w-4" />
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
        </TabsContent>
      </Tabs>

      {/* ── Reply dialog ─────────────────────────────────────────────── */}
      <Dialog open={replyOpen} onOpenChange={(v) => { setReplyOpen(v); if (!v) setReplyTarget(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reply to {replyTarget?.senderName ?? replyTarget?.parent}</DialogTitle>
          </DialogHeader>

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

          <Textarea
            rows={4}
            placeholder="Type your reply…"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            autoFocus
          />
          <p className="text-xs text-muted-foreground text-right">{replyText.length} chars</p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyOpen(false)}>Cancel</Button>
            <Button onClick={sendReply} disabled={replyMutation.isPending || !replyText.trim()}>
              {replyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Send className="mr-2 h-4 w-4" />Send reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
