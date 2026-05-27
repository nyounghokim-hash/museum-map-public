import { withAuth } from "next-auth/middleware"
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server"

const authMiddleware = withAuth({
    pages: {
        signIn: '/login',
    },
})

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

export default function middleware(req: NextRequest, event: NextFetchEvent) {
    const recovered = getRecoveredInternalUrl(req);
    if (recovered) return NextResponse.redirect(recovered);
    if (isProtectedPath(req.nextUrl.pathname)) {
        return authMiddleware(req as any, event);
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
