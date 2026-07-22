import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, FileText, MessageSquare, Plus, Search, UserCircle, UserCog } from "lucide-react";
import {
  Dialog,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Typography,
  Box,
} from "@mui/material";
import { useAuth } from "@/lib/auth";
import {
  type NavItem,
  platformBusiness,
  platformCore,
  platformGov,
  schoolAdmin,
  schoolCampusOps,
  schoolEnterprise,
  schoolFinance,
  schoolOverview,
  schoolStudentLife,
} from "@/lib/nav-items";
import { toast } from "sonner";

// Palette-only entries not surfaced in either sidebar (system-wide or utility pages).
const paletteOnly: NavItem[] = [
  { title: "Reports", url: "/reports", icon: FileText, module: "reports" },
  { title: "User Management", url: "/user-management", icon: UserCog, module: "user-management" },
  { title: "Notifications", url: "/notifications", icon: Bell, module: "dashboard" },
  { title: "Profile", url: "/profile", icon: UserCircle, module: "dashboard" },
];

function dedupeByUrl(items: NavItem[]): NavItem[] {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.url) ? false : (seen.add(item.url), true)));
}

const core: NavItem[] = schoolOverview;
const operations: NavItem[] = [...schoolStudentLife, ...schoolCampusOps];
const financeAndEnterprise: NavItem[] = [...schoolFinance, ...schoolEnterprise];
const admin: NavItem[] = dedupeByUrl([
  ...schoolAdmin,
  ...platformCore,
  ...platformBusiness,
  ...platformGov,
  ...paletteOnly,
]);

const quick: NavItem[] = [
  { title: "Onboard new school", url: "/onboarding", icon: Plus, module: "onboarding" },
];

type Action = { key: string; title: string; icon: NavItem["icon"]; onSelect: () => void; shortcut?: string };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { can } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const go = (url: string) => {
    setOpen(false);
    navigate({ to: url });
  };

  const allowed = (i: NavItem) => !i.module || can(i.module) !== false;

  const groups = useMemo(() => {
    const toActions = (items: NavItem[]): Action[] =>
      items.filter(allowed).map((i) => ({ key: i.url, title: i.title, icon: i.icon, onSelect: () => go(i.url), shortcut: i.shortcut }));

    const extras: Action[] = [
      {
        key: "export-school-data",
        title: "Export school data",
        icon: FileText,
        onSelect: () => {
          setOpen(false);
          toast.success("Export queued — you'll be emailed when ready");
        },
      },
      {
        key: "send-broadcast",
        title: "Send broadcast",
        icon: MessageSquare,
        onSelect: () => {
          setOpen(false);
          toast.info("Broadcast composer opened");
          navigate({ to: "/communication", hash: "broadcast" });
        },
      },
    ];

    const all: { heading: string; items: Action[] }[] = [
      { heading: "Core", items: toActions(core) },
      { heading: "Operations", items: toActions(operations) },
      { heading: "Finance & Enterprise", items: toActions(financeAndEnterprise) },
      { heading: "Administration", items: toActions(admin) },
      { heading: "Quick actions", items: [...toActions(quick), ...extras] },
    ];

    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all
      .map((group) => ({ ...group, items: group.items.filter((item) => item.title.toLowerCase().includes(q)) }))
      .filter((group) => group.items.length > 0);
  }, [query, can]);

  const hasResults = groups.some((group) => group.items.length > 0);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 4, position: "fixed", top: 96, m: 0 } } }}
    >
      <Box sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder="Search pages, students, actions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>
      <Box sx={{ maxHeight: 420, overflowY: "auto", py: 0.5 }}>
        {!hasResults ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 3, textAlign: "center" }}>
            No matches.
          </Typography>
        ) : (
          groups.map((group) =>
            group.items.length === 0 ? null : (
              <List
                key={group.heading}
                dense
                subheader={
                  <ListSubheader component="div" sx={{ lineHeight: "32px", bgcolor: "background.paper" }}>
                    {group.heading}
                  </ListSubheader>
                }
              >
                {group.items.map((item) => (
                  <ListItemButton key={item.key} onClick={item.onSelect}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <item.icon className="h-4 w-4" />
                    </ListItemIcon>
                    <ListItemText primary={item.title} />
                    {item.shortcut && (
                      <Typography variant="caption" color="text.secondary">
                        {item.shortcut}
                      </Typography>
                    )}
                  </ListItemButton>
                ))}
              </List>
            ),
          )
        )}
      </Box>
    </Dialog>
  );
}
