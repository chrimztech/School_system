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
import { roleAllowedForPath } from "@/lib/route-access";
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
  const { can, user } = useAuth();

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

  const allowed = (i: NavItem) =>
    (!i.module || can(i.module) !== false) &&
    (!i.roles || (!!user && i.roles.includes(user.role))) &&
    roleAllowedForPath(i.url, user?.role);

  const groups = useMemo(() => {
    const toActions = (items: NavItem[]): Action[] =>
      items.filter(allowed).map((i) => ({ key: i.url, title: i.title, icon: i.icon, onSelect: () => go(i.url), shortcut: i.shortcut }));

    const extras: Action[] = [
      ...(can("reports") !== false ? [{
        key: "export-school-data",
        title: "Open reports and exports",
        icon: FileText,
        onSelect: () => {
          setOpen(false);
          navigate({ to: "/reports" });
        },
      }] : []),
      ...(!["teacher", "hod", "parent"].includes(user?.role ?? "") ? [{
        key: "send-broadcast",
        title: "Send broadcast",
        icon: MessageSquare,
        onSelect: () => {
          setOpen(false);
          navigate({ to: "/communication", hash: "broadcast" });
        },
      }] : []),
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
  }, [query, can, user]);

  const hasResults = groups.some((group) => group.items.length > 0);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { position: "fixed", top: { xs: 72, sm: 88 }, m: 0, overflow: "hidden" } } }}
    >
      <Box sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.default" }}>
        <Typography sx={{ px: 0.5, mb: 1, fontSize: 10, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: "text.secondary" }}>
          Jump to anywhere
        </Typography>
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
      <Box sx={{ maxHeight: { xs: "calc(100vh - 220px)", sm: 420 }, overflowY: "auto", py: 0.75 }}>
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
                  <ListSubheader component="div" sx={{ lineHeight: "30px", bgcolor: "background.paper", color: "text.secondary", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                    {group.heading}
                  </ListSubheader>
                }
              >
                {group.items.map((item) => (
                  <ListItemButton key={item.key} onClick={item.onSelect} sx={{ mx: 1, mb: 0.25, minHeight: 44, borderRadius: 2 }}>
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
      <Box sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center", justifyContent: "space-between", borderTop: "1px solid", borderColor: "divider", px: 2, py: 1.25, bgcolor: "background.default", color: "text.secondary" }}>
        <Typography variant="caption">Type to filter pages and actions</Typography>
        <Typography variant="caption"><kbd>Esc</kbd> to close</Typography>
      </Box>
    </Dialog>
  );
}
