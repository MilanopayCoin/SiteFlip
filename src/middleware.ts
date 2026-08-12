import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Auth middleware — refreshes Supabase session when configured.
 * Without env vars, requests pass through (demo mode).
 *
 * NOTE: On Cloudflare Workers, OpenNext injects Worker bindings into
 * process.env per request. Project-ref-only URLs are normalized here.
 */
function resolveUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim().replace(/\/$/, "");
  if (/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(value)) return value.toLowerCase();
  if (/^https:\/\//i.test(value)) return value;
  if (/^[a-z0-9]{15,32}$/i.test(value)) {
    return `https://${value.toLowerCase()}.supabase.co`;
  }
  if (/^[a-z0-9-]+\.supabase\.co$/i.test(value)) {
    return `https://${value.toLowerCase()}`;
  }
  return null;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const url = resolveUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
