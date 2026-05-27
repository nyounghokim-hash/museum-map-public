import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || '127.0.0.1';

    // Hash IP for privacy before sending to client
    const ipHash = crypto.createHash('md5').update(ip).digest('hex');

    return NextResponse.json({ ipHash });
}
