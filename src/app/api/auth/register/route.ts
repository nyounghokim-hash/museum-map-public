import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
    try {
        const { username, password, guestId } = await req.json();

        if (!username || !password) {
            return NextResponse.json(
                { message: 'Username and password are required' },
                { status: 400 }
            );
        }

        // Check if user already exists
        const existingUser = await (prisma.user as any).findFirst({
            where: { username },
        });

        if (existingUser) {
            return NextResponse.json(
                { message: 'Username already exists' },
                { status: 409 }
            );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const newUser = await (prisma.user as any).create({
            data: {
                username,
                password: hashedPassword,
                name: username,
                email: `${username}@user.local`, // Fix: Add dummy email to bypass DB constraint
            },
        });

        // GUEST DATA MIGRATION
        if (guestId && guestId.startsWith('guest_')) {
            console.log(`Migrating data from ${guestId} to ${newUser.id}`);
            try {
                // Migrate Saves
                await prisma.save.updateMany({
                    where: { userId: guestId },
                    data: { userId: newUser.id }
                });

                // Migrate Plans
                await prisma.plan.updateMany({
                    where: { userId: guestId },
                    data: { userId: newUser.id }
                });

                // Migrate Collections
                await prisma.collection.updateMany({
                    where: { userId: guestId },
                    data: { userId: newUser.id }
                });

                // Delete the guest user record if it exists
                await prisma.user.delete({
                    where: { id: guestId }
                }).catch(() => { /* Guest user might not have a DB record if only in localStorage, but usually it does */ });

                console.log('Migration successful');
            } catch (migrationError) {
                console.error('Migration failed:', migrationError);
                // We don't fail the whole registration if migration fails, but log it
            }
        }

        return NextResponse.json(
            { message: 'User registered successfully', userId: newUser.id },
            { status: 201 }
        );
    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { message: 'Internal server error', error: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
