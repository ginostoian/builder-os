"use client";

import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QuickAction } from "./quick-actions";
import { QUICK_ICONS } from "./quick-icons";

/** The top bar's "+ New": start whatever this person is allowed to start. */
export function NewMenu({ actions }: { actions: QuickAction[] }) {
  const items = actions.filter((a) => a.group === "new");
  if (items.length === 0) return null;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button>
          <Plus />
          New
          <ChevronDown className="-mr-0.5 opacity-70" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-[210px] rounded-[10px] bg-white p-1 text-[13px] text-ink shadow-pop">
          {items.map((a) => {
            const Icon = QUICK_ICONS[a.icon];
            return (
              <DropdownMenu.Item key={a.id} asChild>
                <Link href={a.href} className="flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2.5 outline-none data-[highlighted]:bg-accent">
                  <Icon className="size-[15px] text-ink-2" />
                  {a.label}
                </Link>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
