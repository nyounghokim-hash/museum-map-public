import { prisma } from './prisma';
import { NextAuthOptions, getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Admin emails — these users automatically get ADMIN role.
const ADMIN_EMAILS = Array.from(new Set([
    'nyoungho.kim@gmail.com',
    'nyounghokim@gmail.com',
    ...(process.env.ADMIN_EMAILS || '').split(',').map(email => email.trim()).filter(Boolean),
]));

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: {
                params: {
                    prompt: 'select_account',
                },
            },
        }),
    ],
    session: {
        strategy: "jwt"
    },
    callbacks: {
        async signIn({ user, account }) {
            if (!user.email) return false;

            try {
                const existingUser = await prisma.user.findFirst({
                    where: { email: user.email }
                });

                const isAdmin = ADMIN_EMAILS.includes(user.email);

                if (!existingUser) {
                    const newUser = await prisma.user.create({
                        data: {
                            email: user.email,
                            name: 'User',
                            username: user.email.split('@')[0],
                            role: isAdmin ? 'ADMIN' : 'USER',
                            image: user.image || null,
                            authProvider: account?.provider || 'unknown',
                        }
                    });

                    // Merge old system_admin data into this Google account
                    if (isAdmin) {
                        try {
                            const oldAdmin = await prisma.user.findFirst({
                                where: { username: 'admin', id: { not: newUser.id } }
                            });
                            if (oldAdmin) {
                                await prisma.$transaction([
                                    prisma.feedback.updateMany({ where: { userId: oldAdmin.id }, data: { userId: newUser.id } }),
                                    prisma.notification.updateMany({ where: { userId: oldAdmin.id }, data: { userId: newUser.id } }),
                                    prisma.user.delete({ where: { id: oldAdmin.id } }),
                                ]);
                            }
                        } catch (mergeErr) {
                            console.error('Admin merge error (non-critical):', mergeErr);
                        }
                    }
                } else {
                    // Existing user — update info on each login
                    await prisma.user.update({
                        where: { id: existingUser.id },
                        data: {
                            image: user.image || (existingUser as any).image || null,
                            role: isAdmin ? 'ADMIN' : (existingUser as any).role || 'USER',
                            lastLoginAt: new Date(),
                        }
                    });
                }
            } catch (err) {
                console.error("Google Sign-In DB Error:", err);
            }

            return true;
        },
        async jwt({ token, user, account }) {
            const email = user?.email || token.email;
            if (email) {
                try {
                    const dbUser = await prisma.user.findFirst({ where: { email } });
                    if (dbUser) {
                        const isAdminEmail = ADMIN_EMAILS.includes(email);
                        token.id = dbUser.id;
                        token.role = isAdminEmail ? 'ADMIN' : ((dbUser as any).role || 'USER');
                        token.termsAgreedAt = (dbUser as any).termsAgreedAt
                            ? (dbUser as any).termsAgreedAt.toISOString() : null;
                    } else if (user) {
                        token.id = user.id;
                        token.role = ADMIN_EMAILS.includes(email) ? 'ADMIN' : 'USER';
                        token.termsAgreedAt = null;
                    }
                } catch {
                    if (user) token.id = user.id;
                    token.role = ADMIN_EMAILS.includes(email) ? 'ADMIN' : (token.role || 'USER');
                    token.termsAgreedAt = token.termsAgreedAt || null;
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                // @ts-ignore
                session.user.id = token.id;
                // @ts-ignore
                session.user.role = token.role;
                // @ts-ignore
                session.user.termsAgreedAt = token.termsAgreedAt;
            }
            return session;
        }
    },
    pages: {
        signIn: '/login',
    }
};

export async function getSessionUser() {
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;

    // @ts-ignore
    const userId = session.user.id;
    if (!userId) return null;

    return await prisma.user.findUnique({
        where: { id: userId }
    });
}

export async function requireAuth() {
    const user = await getSessionUser();
    if (!user) {
        throw new Error('UNAUTHORIZED');
    }
    return user;
}

export async function requireAdmin() {
    const user = await requireAuth();
    const session = await getServerSession(authOptions);
    const sessionEmail = session?.user?.email || '';
    const isSessionAdmin = (session?.user as any)?.role === 'ADMIN' || ADMIN_EMAILS.includes(sessionEmail);
    if (user.role !== 'ADMIN' && !isSessionAdmin) {
        throw new Error('FORBIDDEN');
    }
    if (isSessionAdmin && user.role !== 'ADMIN') {
        try {
            await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
        } catch (err) {
            console.error('Failed to sync admin role:', err);
        }
    }
    return isSessionAdmin ? { ...user, role: 'ADMIN' as const } : user;
}
