import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // @ts-ignore
        const userId = session.user.id;
        // @ts-ignore
        const userRole = session.user.role;

        // Admin cannot delete their own account
        if (userRole === 'ADMIN') {
            return NextResponse.json({ error: 'Admin accounts cannot be deleted' }, { status: 403 });
        }

        if (!userId) {
            return NextResponse.json({ error: 'User ID not found' }, { status: 400 });
        }

        // Delete user and all related data (Prisma cascade handles relations)
        await prisma.user.delete({
            where: { id: userId }
        });

        return NextResponse.json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Account deletion error:', error);
        return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }
}
