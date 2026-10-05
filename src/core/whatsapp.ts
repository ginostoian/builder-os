/**
 * WhatsApp's free "click to chat" links: they open WhatsApp on the phone (or WhatsApp Web) with a message
 * ready to send, from the person's own WhatsApp. No WhatsApp Business account or fees involved.
 */

/** A UK number in international form without the +, as WhatsApp wants it ("07700 900123" → "447700900123"). */
export function waNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.trim().replace(/^\+/, "00").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = `44${d.slice(1)}`;
  return d.length >= 10 && d.length <= 15 ? d : null;
}

/** A link that opens a chat with this number (or lets them pick a contact) with the message filled in. */
export function whatsappUrl(phone: string | null | undefined, text: string): string {
  const n = waNumber(phone);
  return `https://wa.me/${n ?? ""}?text=${encodeURIComponent(text)}`;
}
