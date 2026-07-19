import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, FileText, MessageSquare, Plus, UserCircle, UserCog } from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem,
  CommandList, CommandSeparator, CommandShortcut,
} from "@/components/ui/command";
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

export function CommandPalette() {
  const [open, setOpen] = useState(false);
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

  const go = (url: string) => {
    setOpen(false);
    navigate({ to: url });
  };

  const allowed = (i: NavItem) => !i.module || can(i.module) !== false;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, students, actions…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        <CommandGroup heading="Core">
          {core.filter(allowed).map((i) => (
            <CommandItem key={i.url} onSelect={() => go(i.url)}>
              <i.icon className="mr-2 h-4 w-4" />{i.title}
              {i.shortcut && <CommandShortcut>{i.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Operations">
          {operations.filter(allowed).map((i) => (
            <CommandItem key={i.url} onSelect={() => go(i.url)}>
              <i.icon className="mr-2 h-4 w-4" />{i.title}
              {i.shortcut && <CommandShortcut>{i.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Finance & Enterprise">
          {financeAndEnterprise.filter(allowed).map((i) => (
            <CommandItem key={i.url} onSelect={() => go(i.url)}>
              <i.icon className="mr-2 h-4 w-4" />{i.title}
              {i.shortcut && <CommandShortcut>{i.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Administration">
          {admin.filter(allowed).map((i) => (
            <CommandItem key={i.url} onSelect={() => go(i.url)}>
              <i.icon className="mr-2 h-4 w-4" />{i.title}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick actions">
          {quick.filter(allowed).map((i) => (
            <CommandItem key={i.url} onSelect={() => go(i.url)}>
              <i.icon className="mr-2 h-4 w-4" />{i.title}
            </CommandItem>
          ))}
          <CommandItem onSelect={() => { setOpen(false); toast.success("Export queued — you'll be emailed when ready"); }}>
            <FileText className="mr-2 h-4 w-4" />Export school data
          </CommandItem>
          <CommandItem onSelect={() => { setOpen(false); toast.info("Broadcast composer opened"); navigate({ to: "/communication", hash: "broadcast" }); }}>
            <MessageSquare className="mr-2 h-4 w-4" />Send broadcast
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
