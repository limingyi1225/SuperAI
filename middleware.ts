import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

interface AuthUser {
    username: string;
    password: string;
}

function timingSafeStringEqual(a: string, b: string): boolean {
    const enc = new TextEncoder();
    const aBytes = enc.encode(a);
    const bBytes = enc.encode(b);
    const len = Math.max(aBytes.length, bBytes.length);
    let diff = aBytes.length ^ bBytes.length;
    for (let i = 0; i < len; i++) {
        diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
    }
    return diff === 0;
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
    if (raw === undefined) return fallback;
    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
}

function parseAuthUsers(raw: string | undefined): AuthUser[] {
    if (!raw) return [];

    return raw
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
        .map(item => {
            const separator = item.indexOf(':');
            if (separator <= 0) return null;

            const username = item.slice(0, separator).trim();
            const password = item.slice(separator + 1).trim();
            if (!username || !password) return null;
            return { username, password };
        })
        .filter((entry): entry is AuthUser => entry !== null);
}

function readBasicAuth(request: NextRequest): AuthUser | null {
    const header = request.headers.get('authorization');
    if (!header || !header.startsWith('Basic ')) return null;

    const encoded = header.slice('Basic '.length).trim();
    if (!encoded) return null;

    try {
        const decoded = atob(encoded);
        const separator = decoded.indexOf(':');
        if (separator < 0) return null;

        const username = decoded.slice(0, separator);
        const password = decoded.slice(separator + 1);
        if (!username || !password) return null;

        return { username, password };
    } catch {
        return null;
    }
}

function unauthorizedResponse(realm: string, message = 'Authentication required'): NextResponse {
    return new NextResponse(message, {
        status: 401,
        headers: {
            'WWW-Authenticate': `Basic realm="${realm}", charset="UTF-8"`,
            'Cache-Control': 'no-store',
        },
    });
}

export function middleware(request: NextRequest) {
    const authEnabled = parseBoolean(process.env.AUTH_ENABLED, process.env.NODE_ENV === 'production');
    if (!authEnabled) {
        return NextResponse.next();
    }

    const authUsers = parseAuthUsers(process.env.AUTH_USERS);
    const realm = process.env.AUTH_REALM || 'IsabbY';

    if (authUsers.length === 0) {
        return new NextResponse('Authentication misconfigured: AUTH_USERS is empty', {
            status: 500,
            headers: { 'Cache-Control': 'no-store' },
        });
    }

    const credentials = readBasicAuth(request);
    if (!credentials) {
        return unauthorizedResponse(realm);
    }

    // Walk every configured user to keep timing constant — no early exit.
    let isAllowed = false;
    for (const user of authUsers) {
        const usernameMatch = timingSafeStringEqual(user.username, credentials.username);
        const passwordMatch = timingSafeStringEqual(user.password, credentials.password);
        if (usernameMatch && passwordMatch) isAllowed = true;
    }

    if (!isAllowed) {
        return unauthorizedResponse(realm, 'Invalid credentials');
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
    ],
};
