"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { Menu, X } from "lucide-react";

/** Phones and small tablets: the sidebar slides in from the left behind a menu button. */
export function MobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const [at, setAt] = React.useState(pathname);
  // Close after following a link (the page changed).
  if (at !== pathname) {
    setAt(pathname);
    if (open) setOpen(false);
  }
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger aria-label="Menu" className="-ml-1.5 flex size-9 flex-none items-center justify-center rounded-md text-ink-2 hover:bg-accent lg:hidden">
        <Menu className="size-5" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30 data-[state=open]:animate-in data-[state=open]:fade-in-0 lg:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-[min(300px,86vw)] flex-col gap-3.5 overflow-y-auto bg-surface px-2.5 py-3 font-sans text-[13px] leading-[1.4] text-ink shadow-pop outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-left lg:hidden"
        >
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          <Dialog.Close aria-label="Close menu" className="absolute top-3 right-3 z-10 rounded-md p-1.5 text-subtle hover:bg-accent hover:text-ink">
            <X className="size-4" />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
