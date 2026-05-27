import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const ADMIN_PW = process.env.ADMIN_PASSWORD || '';
const SUPER_PW = process.env.SUPER_ADMIN_PASSWORD || '';

function getAdminPw(req: Request): string | null {
    return req.headers.get('x-admin-password');
}

async function isAdmin(req: Request): Promise<boolean> {
    // Method 1: Password header
    const pw = getAdminPw(req);
    if (pw && pw === ADMIN_PW) return true;
    // Method 2: Google OAuth session with ADMIN role
    const session = await getServerSession(authOptions);
    if (session && (session.user as any).role === 'ADMIN') return true;
    return false;
}

export async function GET(req: Request) {
    if (!(await isAdmin(req))) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const users = await prisma.user.findMany({
            where: {
                email: { not: null },
                name: { not: 'System Admin' },
            },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                role: true,
                createdAt: true,
                preferences: true,
                gender: true,
                ageRange: true,
                lastLoginAt: true,
                authProvider: true,
                termsAgreedAt: true,
                privacyAgreedAt: true,
            },
            orderBy: {
                createdAt: 'asc',
            }
        });

        // Assign sequential member numbers (1-based, by signup order) then reverse for newest-first
        const usersWithNo = users.map((u, i) => ({ ...u, memberNo: i + 1 })).reverse();

        return NextResponse.json({ data: usersWithNo });
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('id');
    const superPw = req.headers.get('x-super-password');

    if (!(await isAdmin(req))) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    if (!userId) {
        return NextResponse.json({ message: 'User ID required' }, { status: 400 });
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }
        if (user.role === 'ADMIN') {
            return NextResponse.json({ message: 'Cannot delete admin users' }, { status: 403 });
        }
        // Super admin protection: nyoungho.kim@gmail.com requires additional password
        if (user.email === 'nyoungho.kim@gmail.com') {
            if (!superPw || superPw !== SUPER_PW) {
                return NextResponse.json({ message: 'Super admin password required', requireSuperPw: true }, { status: 403 });
            }
        }

        // Hard delete: remove user and all related data (Prisma cascade)
        await prisma.user.delete({
            where: { id: userId }
        });

        return NextResponse.json({ data: { deleted: true } });
    } catch (error) {
        console.error('Error deleting user:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
