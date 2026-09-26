import { NextRequest, NextResponse } from "next/server";
import { apiKeyAuthentication } from "@/server/apiKeyAuth";
import { getCorsHeaders } from "@/lib/cors";
import { checkEdgeRateLimit, extractClientIp } from "@/lib/edgeRateLimiter";

// Define protected and public routes
const protectWithAPIKeyPatterns: ProtectedRoute[] = [
  { methods: ["POST"], pattern: /^\/api\/v1\/ticket(\/.*)?$/ },
  { methods: ["PATCH"], pattern: /^\/api\/v1\/order(\/.*)?$/ },
  { methods: ["*"], pattern: /^\/api\/v1\/user(\/.*)?$/ },
];

// New patterns for the `/api/client/v1/protected/*` routes (protected routes, no API key auth)
const protectClientAPI: ProtectedRoute[] = [
  {
    methods: ["POST", "GET", "OPTIONS"],
    pattern: /^\/api\/client\/v1\/protected\/.*$/,
  }, // Protected routes (without API key)
];

// Patterns for Swagger docs and public routes (these don't require authentication)
const publicRoutes: ProtectedRoute[] = [
  { methods: ["GET", "OPTIONS"], pattern: /^\/api\/client\/v1\/public\/.*$/ }, // Public routes
  { methods: ["GET", "OPTIONS"], pattern: /^\/api\/docs\/.*$/ }, // Swagger docs
];

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-url", request.url);

  const pathname = request.nextUrl.pathname;
  const method = request.method;
  const origin = request.headers.get("origin");

  // Domain-restricted CORS headers based on allowlist
  const corsHeaders = getCorsHeaders(origin);

  // Handle preflight (OPTIONS) request
  if (method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Edge Rate Limiting for Public / Critical APIs
  let rateLimitCategory: string | null = null;
  let rateLimitMax = 60;

  if (pathname.startsWith("/api/v1/auth")) {
    rateLimitCategory = "auth";
    rateLimitMax = 30; // 30 req/min for auth
  } else if (pathname.startsWith("/api/v1/order")) {
    rateLimitCategory = "order";
    rateLimitMax = 20; // 20 req/min for orders
  } else if (pathname.startsWith("/api/client/v1")) {
    rateLimitCategory = "client_api";
    rateLimitMax = 60; // 60 req/min for client API
  }

  if (rateLimitCategory) {
    const clientIp = extractClientIp(request.headers);
    const rl = checkEdgeRateLimit(clientIp, rateLimitCategory, rateLimitMax, 60_000);

    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: "too_many_requests",
          message: "Rate limit exceeded. Please wait a moment before retrying.",
        },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Retry-After": String(Math.max(1, rl.reset - Math.floor(Date.now() / 1000))),
            "X-RateLimit-Limit": String(rl.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(rl.reset),
          },
        }
      );
    }

    requestHeaders.set("X-RateLimit-Limit", String(rl.limit));
    requestHeaders.set("X-RateLimit-Remaining", String(rl.remaining));
    requestHeaders.set("X-RateLimit-Reset", String(rl.reset));
  }

  // Check if the request matches any of the protected routes
  const isProtected = protectWithAPIKeyPatterns.some(
    (route) => (route.methods.includes("*") || route.methods.includes(method)) && route.pattern.test(pathname)
  );

  // Check if the request matches the new client protected API routes
  const isClientAPIProtected = protectClientAPI.some(
    (route) => (route.methods.includes("*") || route.methods.includes(method)) && route.pattern.test(pathname)
  );

  // Check if the request matches public routes (Swagger docs, etc.)
  const isPublic = publicRoutes.some(
    (route) => (route.methods.includes("*") || route.methods.includes(method)) && route.pattern.test(pathname)
  );

  // If the request is protected by client API route
  if (isClientAPIProtected) {
    // No API key authentication here; apply JWT or other authentication methods if necessary.

    // Return response with CORS headers (for POST, GET)
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
      headers: corsHeaders, // Always add CORS headers to responses
    });
  }

  // Apply API key authentication for non-client API routes
  if (isProtected) {
    // Apply authentication using apiKeyAuthentication (for other non-client protected routes)
    const errorResponse = apiKeyAuthentication(request);
    if (errorResponse) return errorResponse;

    // Return the response with CORS headers for protected routes
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
      headers: corsHeaders, // Apply CORS headers to protected routes
    });
  }

  // Handle public routes and Swagger docs (no authentication needed)
  if (isPublic) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
      headers: corsHeaders, // Add CORS headers for public routes
    });
  }

  // Apply CORS headers to all other routes (just in case)
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
    headers: corsHeaders, // Add CORS headers to the rest of the routes
  });
}

type ProtectedRoute = {
  methods: string[]; // Array of HTTP methods (GET, POST, etc.)
  pattern: RegExp; // Regular expression for matching paths
};
//
