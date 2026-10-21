import { getKommoClientForClient } from '@/lib/kommo-auth';

interface PhoneField {
  field_code?: string;
  values?: Array<{ value?: unknown }>;
}

/**
 * The digits of a Kommo contact's main phone, or null when the contact has none (e.g. an
 * Instagram-only contact) or Kommo isn't configured for this client. Throws on Kommo/auth errors
 * so the caller can answer "try again later" instead of silently dropping the message.
 */
export async function resolveKommoContactPhone(
  clientId: string,
  kommoContactId: number,
): Promise<string | null> {
  const conn = await getKommoClientForClient(clientId);
  if (!conn) return null;

  const contact = await conn.kommo.contacts.getById(kommoContactId);
  const fields = contact?.custom_fields_values as PhoneField[] | null | undefined;
  const raw = fields?.find((f) => f.field_code === 'PHONE')?.values?.[0]?.value;
  const digits = raw !== undefined && raw !== null ? String(raw).replace(/\D/g, '') : '';
  return digits || null;
}
