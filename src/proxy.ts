import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAMES = [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
];

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

function hasSessionCookie(req: NextRequest) {
    return SESSION_COOKIE_NAMES.some((name) => Boolean(req.cookies.get(name)?.value));
}

export default function proxy(req: NextRequest) {
    const isLoggedIn = hasSessionCookie(req);
    const isOnDashboard = req.nextUrl.pathname.startsWith("/dashboard");
    const isOnAdmin = req.nextUrl.pathname.startsWith("/admin");
    const isOnLogin = req.nextUrl.pathname.startsWith("/login");

    // Se estiver tentando acessar o dashboard sem login -> Login
    if ((isOnDashboard || isOnAdmin) && !isLoggedIn) {
        return NextResponse.redirect(new URL("/login", req.nextUrl));
    }

    // Se já estiver logado e tentar acessar login -> Dashboard
    if (isOnLogin && isLoggedIn) {
        return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
    }

    return NextResponse.next();
}
