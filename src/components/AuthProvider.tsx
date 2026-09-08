"use client";

import { SessionProvider, useSession, signOut } from "next-auth/react";
import { useEffect } from "react";

// isActive is only refreshed from the DB when the session is actually re-fetched through
// NextAuth's pipeline (getServerSession/API routes/this refetch) — middleware's lightweight
// getToken() decode does NOT re-run the jwt callback, so it can't see a deactivation that
// happened after the cookie was issued. This polling + guard is what makes an admin
// deactivating the account (e.g. from the portal) actually end an already-open session.
function InactiveSessionGuard() {
    const { data: session } = useSession();

    useEffect(() => {
        if (session?.user && session.user.isActive === false) {
            signOut({ callbackUrl: "/auth/login" });
        }
    }, [session]);

    return null;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    return (
        <SessionProvider refetchOnWindowFocus={false} refetchInterval={60}>
            <InactiveSessionGuard />
            {children}
        </SessionProvider>
    );
};
