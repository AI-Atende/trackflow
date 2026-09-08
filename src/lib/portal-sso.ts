import { jwtVerify } from "jose";

const TRACKFLOW_SSO_SECRET = new TextEncoder().encode(
    process.env.TRACKFLOW_SSO_SECRET || "trackflow-sso-secret"
);

export interface PortalSsoClaims {
    clientId: string;
    email: string;
    name: string;
    /** Kommo subdomain from the portal's KommoConfig for this client, or null if not
     * configured there. Mirrored into IntegrationConfig on every login — see auth.ts. */
    kommoSubdomain: string | null;
}

/**
 * Verifies a short-lived SSO token minted by the portal (lib/trackflow-sso.ts there).
 * Throws if the token is missing, expired, or signed with a different secret.
 */
export async function verifyPortalSsoToken(token: string): Promise<PortalSsoClaims> {
    const { payload } = await jwtVerify(token, TRACKFLOW_SSO_SECRET);

    if (!payload.sub || typeof payload.email !== "string" || typeof payload.name !== "string") {
        throw new Error("Invalid portal SSO token payload");
    }

    return {
        clientId: payload.sub,
        email: payload.email,
        name: payload.name,
        kommoSubdomain: typeof payload.kommoSubdomain === "string" ? payload.kommoSubdomain : null,
    };
}
