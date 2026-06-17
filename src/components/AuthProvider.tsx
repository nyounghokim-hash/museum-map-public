'use client';
import { SessionProvider, useSession, signOut } from 'next-auth/react';
import { useEffect } from 'react';
import { clearClientAccountStateForLogout } from '@/lib/client-account-state';

function GuestSessionGuard({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();

    useEffect(() => {
        if (status === 'unauthenticated') {
            return;
        }

        if (status === 'authenticated' && session?.user?.email && !session.user.name?.startsWith('guest_')) {
            sessionStorage.setItem('user-email', session.user.email);
        }

        if (status === 'authenticated' && session?.user?.name) {
            // Store user email for per-user localStorage keys (e.g. museum-history)
            if (session.user.email && !session.user.name.startsWith('guest_')) {
                sessionStorage.setItem('user-email', session.user.email);
            }
            // Check if user is a generated guest
            if (session.user.name.startsWith('guest_')) {
                const isGuestValidated = sessionStorage.getItem('isGuest');
                if (!isGuestValidated) {
                    // This means the browser was closed or session storage cleared
                    clearClientAccountStateForLogout();
                    signOut({ redirect: true, callbackUrl: '/login' });
                }
            }
        }
    }, [status, session]);

    return <>{children}</>;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <GuestSessionGuard>{children}</GuestSessionGuard>
        </SessionProvider>
    );
}
