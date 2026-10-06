import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { whatsappUrl } from "@/core/whatsapp";
import { cn } from "@/lib/utils";

/**
 * Opens WhatsApp (the app on a phone, WhatsApp Web on a computer) with the message ready to send to this
 * number, or with a contact picker when there's no number. Free: it uses the person's own WhatsApp.
 */
export function WhatsAppButton({ phone, text, label = "WhatsApp", className }: { phone: string | null | undefined; text: string; label?: string; className?: string }) {
  return (
    <Button variant="secondary" asChild className={className}>
      <a href={whatsappUrl(phone, text)} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="text-[#25A244]" />
        {label}
      </a>
    </Button>
  );
}

/** A small WhatsApp link to sit next to a phone number. */
export function WhatsAppLink({ phone, text = "", className }: { phone: string; text?: string; className?: string }) {
  return (
    <a href={whatsappUrl(phone, text)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${phone}`} title="Message on WhatsApp" className={cn("inline-flex items-center gap-1 text-[12px] text-ink-2 hover:text-ink", className)}>
      <MessageCircle className="size-3.5 text-[#25A244]" />
      WhatsApp
    </a>
  );
}
