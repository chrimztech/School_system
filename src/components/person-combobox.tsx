import { useState } from "react";
import { ChevronsUpDown, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type PersonOption = { id: string; label: string; sublabel?: string };

/**
 * Searchable picker for selecting a real Student/Teacher/User record instead of typing
 * a name freehand. Purely presentational — callers own the option list and what happens
 * on selection (e.g. auto-filling other form fields).
 */
export function PersonCombobox({
  options,
  onSelect,
  placeholder = "Search…",
  emptyText = "No matches.",
  loading = false,
  disabled = false,
}: {
  options: PersonOption[];
  onSelect: (option: PersonOption) => void;
  placeholder?: string;
  emptyText?: string;
  loading?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal text-muted-foreground")}
        >
          <span className="flex items-center gap-2 truncate">
            <UserRound className="h-4 w-4 shrink-0" />
            {loading ? "Loading…" : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Type a name…" />
          <CommandList>
            <CommandEmpty>{loading ? "Loading…" : emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.label}
                  onSelect={() => {
                    onSelect(option);
                    setOpen(false);
                  }}
                >
                  <div className="flex flex-col">
                    <span>{option.label}</span>
                    {option.sublabel && <span className="text-xs text-muted-foreground">{option.sublabel}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
