import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { Send, MessageSquare, Phone, Loader2, Plus } from "lucide-react";
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
import { api } from "@/lib/api";

export const Route = createFileRoute("/communication")({
  head: () => ({ meta: [{ title: "Communication - SRMS" }] }),
  component: CommunicationPage,
});

function CommunicationPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();

  const hash = useRouterState({ select: (router) => router.location.hash });
  const [tab, setTab] = useState("messages");
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState<any>(null);
  const [replyText, setReplyText] = useState("");

  // Broadcast / announcement compose
  const [broadcastRecipients, setBroadcastRecipients] = useState("All parents");
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastChannels, setBroadcastChannels] = useState<string[]>(["SMS", "WhatsApp"]);
  const [broadcastPriority, setBroadcastPriority] = useState("Normal");
  const [broadcastScheduled, setBroadcastScheduled] = useState("");
  const [broadcastLanguage, setBroadcastLanguage] = useState("English");
  const [broadcastRequireAck, setBroadcastRequireAck] = useState("no");

  // Create announcement dialog
  const [annoOpen, setAnnoOpen] = useState(false);
  const [annoForm, setAnnoForm] = useState({ title: "", body: "", audience: "All", channels: "SMS, WhatsApp" });

  useEffect(() => {
    const nextTab = hash === "#broadcast" || hash === "broadcast"
      ? "broadcast"
      : hash === "#announcements" || hash === "announcements"
        ? "announcements"
        : null;
    if (nextTab) setTab(nextTab);
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
    mutationFn: ({ id, body }: { id: string; body: string }) => api.communication.replyMessage(schoolId, id, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", schoolId] });
      toast.success(`Reply sent to ${replyTarget?.senderName ?? replyTarget?.parent}`);
      setReplyOpen(false);
    },
    onError: () => toast.error("Failed to send reply"),
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

  const broadcastMutation = useMutation({
    mutationFn: (data: any) => api.communication.createAnnouncement(schoolId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements", schoolId] });
      toast.success(`Broadcast queued — sending via ${broadcastChannels.join(", ")} to ${broadcastRecipients}`);
      setBroadcastSubject("");
      setBroadcastBody("");
      setBroadcastScheduled("");
    },
    onError: () => toast.error("Failed to send broadcast"),
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
      active: true,
    });
  };

  const toggleChannel = (channel: string) => {
    setBroadcastChannels((prev) => prev.includes(channel) ? prev.filter((item) => item !== channel) : [...prev, channel]);
  };

  const sendBroadcast = () => {
    if (!broadcastSubject.trim() || !broadcastBody.trim()) { toast.error("Subject and message are required"); return; }
    broadcastMutation.mutate({
      title: broadcastSubject.trim(),
      body: broadcastBody.trim(),
      audience: broadcastRecipients,
      channels: broadcastChannels.join(", "),
      publishDate: broadcastScheduled ? broadcastScheduled.slice(0, 10) : new Date().toISOString().slice(0, 10),
      active: true,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communication"
        description="SMS · WhatsApp · Email · USSD fallback for parents without smartphones"
        actions={<Button onClick={() => setTab("broadcast")}><Send className="mr-2 h-4 w-4" />New broadcast</Button>}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="messages"><MessageSquare className="mr-2 h-4 w-4" />Parent messages</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="broadcast">Send broadcast</TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="mt-4 space-y-2">
          {msgsLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading messages…</span>
            </div>
          ) : (messages as any[]).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            (messages as any[]).map((message: any) => (
              <div key={message.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold">{message.subject}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      From {message.senderName ?? message.parent} · re: {message.studentName ?? message.student}
                    </p>
                  </div>
                  <Badge variant={message.status === "open" ? "destructive" : "secondary"}>{message.status}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{(message.sentAt ?? message.date ?? "").slice(0, 10)}</span>
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={() => openReply(message)}>
                    Reply
                  </Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="announcements" className="mt-4 space-y-3">
          <div className="flex justify-end">
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
                        {["All", "All parents", "All staff", "All secondary", "Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Form 6", "All primary", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"].map((a) => (
                          <SelectItem key={a} value={a}>{a}</SelectItem>
                        ))}
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
          </div>

          {annoLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading announcements…</span>
            </div>
          ) : (announcements as any[]).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No announcements yet.</p>
          ) : (
            (announcements as any[]).map((announcement: any) => (
              <div key={announcement.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold">{announcement.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{announcement.body}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{(announcement.publishDate ?? announcement.date ?? "").slice(0, 10)}</span>
                </div>
                {announcement.channels && (
                  <div className="mt-3 flex gap-1">
                    {(typeof announcement.channels === "string" ? announcement.channels.split(",") : (announcement.channels as string[])).map((channel: string) => (
                      <Badge key={channel} variant="outline">{channel.trim()}</Badge>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="broadcast" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium uppercase text-muted-foreground">Recipients</Label>
                <Select value={broadcastRecipients} onValueChange={setBroadcastRecipients}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All parents">All parents</SelectItem>
                    <SelectItem value="Form 1 parents">Form 1 parents</SelectItem>
                    <SelectItem value="Form 2 parents">Form 2 parents</SelectItem>
                    <SelectItem value="Form 3 parents">Form 3 parents</SelectItem>
                    <SelectItem value="Form 4 parents">Form 4 parents</SelectItem>
                    <SelectItem value="Form 5 parents">Form 5 parents</SelectItem>
                    <SelectItem value="Form 6 parents">Form 6 parents</SelectItem>
                    <SelectItem value="All primary parents">All primary parents</SelectItem>
                    <SelectItem value="All staff">All staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs font-medium uppercase text-muted-foreground">Subject</Label>
                  <Input className="mt-1" value={broadcastSubject} onChange={(event) => setBroadcastSubject(event.target.value)} placeholder="Term 2 Mid-Term Exams" maxLength={120} />
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
                <Label className="text-xs font-medium uppercase text-muted-foreground">Message</Label>
                <Textarea className="mt-1" rows={5} value={broadcastBody} onChange={(event) => setBroadcastBody(event.target.value)} placeholder="Dear parent / guardian, ..." />
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
                  {["SMS", "WhatsApp", "Email", "USSD"].map((channel) => (
                    <button key={channel} onClick={() => toggleChannel(channel)} className="transition-opacity">
                      <Badge variant={broadcastChannels.includes(channel) ? "secondary" : "outline"} className="cursor-pointer">
                        {channel === "USSD" && <Phone className="mr-1 h-3 w-3" />}{channel}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium uppercase text-muted-foreground">Require read acknowledgement</Label>
                <div className="mt-1">
                  <Select value={broadcastRequireAck} onValueChange={setBroadcastRequireAck}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No — standard send</SelectItem>
                      <SelectItem value="yes">Yes — track read receipts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="w-full sm:w-auto" onClick={sendBroadcast} disabled={broadcastMutation.isPending}>
                {broadcastMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" />{broadcastScheduled ? "Schedule broadcast" : `Send to ${broadcastRecipients}`}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Reply to {replyTarget?.senderName ?? replyTarget?.parent}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Re: {replyTarget?.subject} · {replyTarget?.studentName ?? replyTarget?.student}</p>
          <Textarea rows={4} placeholder="Type your reply..." value={replyText} onChange={(event) => setReplyText(event.target.value)} className="mt-2" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyOpen(false)}>Cancel</Button>
            <Button onClick={sendReply} disabled={replyMutation.isPending}>
              {replyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Send className="mr-2 h-4 w-4" />Send reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
