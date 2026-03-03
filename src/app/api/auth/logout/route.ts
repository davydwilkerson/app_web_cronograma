import { NextResponse } from "next/server";

const AUTH_COOKIES = [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "authjs.csrf-token",
    "__Host-authjs.csrf-token",
    "authjs.callback-url",
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "next-auth.csrf-token",
    "__Host-next-auth.csrf-token",
    "next-auth.callback-url",
];

function getLoginUrl() {
    return new URL(
        "/login?message=Sessao%20encerrada.%20Faca%20login%20novamente.",
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    );
}

function clearAuthCookies(response: NextResponse) {
    for (const name of AUTH_COOKIES) {
        response.cookies.set({
            name,
            value: "",
            path: "/",
            expires: new Date(0),
        });
        response.cookies.set({
            name,
            value: "",
            path: "/",
            secure: true,
            expires: new Date(0),
        });
    }
}

async function logoutResponse() {
    const response = NextResponse.redirect(getLoginUrl(), { status: 302 });
    clearAuthCookies(response);
    return response;
}

export async function POST() {
    return logoutResponse();
}

export async function GET() {
    return logoutResponse();
}
