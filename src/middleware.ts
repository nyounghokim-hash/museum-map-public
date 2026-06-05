import { getToken } from "next-auth/jwt"
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server"

function isProtectedPath(pathname: string) {
    return pathname === '/saved'
        || pathname.startsWith('/saved/')
        || pathname === '/plans'
        || pathname.startsWith('/plans/')
        || pathname === '/compare'
        || pathname.startsWith('/compare/')
        || pathname === '/collections/new'
        || pathname.startsWith('/collections/edit/');
}

function getRecoveredInternalUrl(req: NextRequest) {
    const raw = req.nextUrl.pathname + req.nextUrl.search;
    const decoded = decodeURIComponent(raw);
    const match = decoded.match(/https?:\/{1,2}(?:www\.)?museummap\.app(\/[^?#]*)?(\?[^#]*)?/i);
    if (!match) return null;
    const recovered = `${match[1] || '/'}${match[2] || ''}`;
    if (recovered === raw) return null;
    return new URL(recovered, req.url);
}

export default async function middleware(req: NextRequest, _event: NextFetchEvent) {
    const recovered = getRecoveredInternalUrl(req);
    if (recovered) return NextResponse.redirect(recovered);
    if (isProtectedPath(req.nextUrl.pathname)) {
        const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
        if (!token) {
            const loginUrl = new URL('/login', req.url);
            loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search);
            return NextResponse.redirect(loginUrl);
        }
    }
    return NextResponse.next();
}

export const config = {
    matcher: [
        "/collections/new",
        "/collections/edit/:path*",
        "/saved/:path*",
        "/plans/:path*",
        "/compare",
        "/compare/:path*",
        "/https\\:/:path*",
        "/http\\:/:path*",
        "/((?!api|_next/static|_next/image|favicon.ico)(?=.*https%3A%2F%2F).*)"
    ],
}
