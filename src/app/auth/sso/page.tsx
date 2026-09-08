"use client";

import { signIn } from "next-auth/react";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PortalSsoContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState(false);

    useEffect(() => {
        const token = searchParams.get("token");
        if (!token) {
            setError(true);
            return;
        }

        signIn("portal-sso", { token, redirect: false }).then((result) => {
            if (result?.ok) {
                router.replace("/");
            } else {
                setError(true);
            }
        });
    }, [searchParams, router]);

    if (error) {
        return (
            <div className="max-w-sm text-center space-y-2">
                <p className="text-lg font-medium">Não foi possível entrar via portal</p>
                <p className="text-sm text-muted-foreground">
                    O link pode ter expirado. Volte ao portal e clique em &quot;Abrir TrackFlow&quot; novamente.
                </p>
            </div>
        );
    }

    return <p className="text-sm text-muted-foreground">Entrando...</p>;
}

export default function PortalSsoPage() {
    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Suspense fallback={<p className="text-sm text-muted-foreground">Entrando...</p>}>
                <PortalSsoContent />
            </Suspense>
        </div>
    );
}
