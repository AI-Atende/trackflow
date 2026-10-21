// Pure/client-safe: how to describe which pipeline reported a tracked message. 'portal' = relayed
// by the portal from the messaging platform (channel is whatsapp | whatsapp_lite); 'kommo' =
// relayed by the Assistant from Kommo's own native-channel webhook (channel is Kommo's origin,
// already translated, e.g. "WhatsApp Cloud API" / "WhatsApp Web"). A client can have both.
export function messageViaLabel(
  source: string | null | undefined,
  channel: string | null | undefined,
): string {
  if (source === 'kommo') return channel ? `Kommo · ${channel}` : 'Kommo';
  if (channel === 'whatsapp_lite') return 'Portal · WhatsApp Lite (QR Code)';
  if (channel === 'whatsapp') return 'Portal · WhatsApp (API oficial)';
  return 'Portal';
}
