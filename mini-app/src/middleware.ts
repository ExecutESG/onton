import { NextRequest, NextResponse } from "next/server";
import { apiKeyAuthentication } from "@/server/auth";
import { getCorsHeaders } from "@/lib/cors";

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
