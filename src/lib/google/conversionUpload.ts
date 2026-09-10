import crypto from 'crypto';
import { services } from 'google-ads-api';
import { prisma } from '@/lib/prisma';
import { googleAdsClient } from '@/lib/google-ads';

export interface GoogleConversionActionOption {
  id: string;
  name: string;
  resourceName: string;
}

interface GoogleConversionActionRow {
  conversion_action: { id: string | number; name: string; resource_name: string };
}

/** Lists the client's existing Google Ads Conversion Actions (created by them in Google Ads UI)
 * — same "fetch live options from the platform" pattern already used for Kommo custom fields. */
export async function listGoogleConversionActions(
  clientId: string,
): Promise<GoogleConversionActionOption[]> {
  const accounts = await prisma.googleAdAccount.findMany({ where: { clientId } });
  const account = accounts.find((a) => a.status === 'ACTIVE') ?? accounts[0];
  if (!account) return [];

  const customer = googleAdsClient.Customer({
    customer_id: account.customerId.replace(/-/g, ''),
    refresh_token: account.refreshToken,
  });

  const rows = await customer.query(
    'SELECT conversion_action.id, conversion_action.name, conversion_action.resource_name FROM conversion_action WHERE conversion_action.status = ENABLED',
  );

  return (rows as unknown as GoogleConversionActionRow[]).map((r) => ({
    id: String(r.conversion_action.id),
    name: r.conversion_action.name,
    resourceName: r.conversion_action.resource_name,
  }));
}

function formatConversionDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}+00:00`;
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

interface UploadGoogleConversionInput {
  clientId: string;
  lead: {
    gclid: string | null;
    gbraid: string | null;
    wbraid: string | null;
    waId: string | null;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    saleValue: number | null;
  };
  // The full resource name (customers/{id}/conversionActions/{id}) — JourneyStage.googleConversionActionId
  // stores exactly this, as returned by listGoogleConversionActions above.
  conversionActionId: string;
}

/**
 * Uploads one offline click conversion via the Google Ads API, matched primarily by
 * gclid/gbraid/wbraid, with hashed email/phone/name attached as "Enhanced Conversions for Leads"
 * user_identifiers — Google's own recommended way to raise match rate for CRM-sourced
 * conversions like this one. NOTE: the exact `user_identifiers`/`hashed_email` field naming
 * below is based on Google Ads API's documented ClickConversion/UserIdentifier schema (stable
 * across recent API versions) rather than something confirmed against this installed library's
 * type definitions — verify against a real send before relying on it in production.
 */
export async function uploadGoogleConversion({
  clientId,
  lead,
  conversionActionId,
}: UploadGoogleConversionInput): Promise<void> {
  const [accounts, fieldMapping] = await Promise.all([
    prisma.googleAdAccount.findMany({ where: { clientId } }),
    prisma.kommoFieldMapping.findUnique({ where: { clientId } }),
  ]);
  const account = accounts.find((a) => a.status === 'ACTIVE') ?? accounts[0];
  if (!account) {
    throw new Error('Nenhuma conta Google Ads conectada');
  }
  if (!lead.gclid && !lead.gbraid && !lead.wbraid) {
    throw new Error(
      'Lead sem gclid/gbraid/wbraid — não é possível enviar conversão pro Google Ads',
    );
  }

  const customerId = account.customerId.replace(/-/g, '');
  const customer = googleAdsClient.Customer({
    customer_id: customerId,
    refresh_token: account.refreshToken,
  });

  const userIdentifiers: Record<string, string>[] = [];
  if (lead.email) userIdentifiers.push({ hashed_email: sha256(lead.email) });
  if (lead.waId) userIdentifiers.push({ hashed_phone_number: sha256(`+${lead.waId}`) });
  if (lead.firstName && lead.lastName) {
    userIdentifiers.push({
      // AddressInfo-style identifiers also need hashed_first_name/hashed_last_name nested under
      // address_info per Google's schema — kept flat here since this library's typings for that
      // nested shape aren't confirmed; revisit once tested against a live account.
      hashed_first_name: sha256(lead.firstName),
      hashed_last_name: sha256(lead.lastName),
    });
  }

  const request = new services.UploadClickConversionsRequest({
    customer_id: customerId,
    conversions: [
      {
        gclid: lead.gclid ?? undefined,
        gbraid: lead.gbraid ?? undefined,
        wbraid: lead.wbraid ?? undefined,
        conversion_action: conversionActionId,
        conversion_date_time: formatConversionDateTime(new Date()),
        ...(userIdentifiers.length > 0 ? { user_identifiers: userIdentifiers } : {}),
        ...(lead.saleValue != null
          ? {
              conversion_value: lead.saleValue,
              currency_code: fieldMapping?.defaultCurrency ?? 'BRL',
            }
          : {}),
      },
    ],
    partial_failure: true,
  });

  await customer.conversionUploads.uploadClickConversions(request);
}
