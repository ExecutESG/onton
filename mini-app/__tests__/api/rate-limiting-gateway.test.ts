import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  checkEdgeRateLimit,
  extractClientIp,
  resetEdgeRateLimiter,
} from "@/lib/edgeRateLimiter";
import { middleware } from "@/middleware";
import { NextRequest } from "next/server";

describe("Edge Rate Limiting & Gateway (#985)", () => {
  beforeEach(() => {
    resetEdgeRateLimiter();
    vi.restoreAllMocks();
  });

  describe("In-Memory Sliding Window Rate Limiter", () => {
    it("should allow requests under the defined limit and decrement remaining quota", () => {
      const result1 = checkEdgeRateLimit("192.168.1.1", "auth", 5, 60_000);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(4);
      expect(result1.limit).toBe(5);
      expect(result1.reset).toBeGreaterThan(Math.floor(Date.now() / 1000));

      const result2 = checkEdgeRateLimit("192.168.1.1", "auth", 5, 60_000);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(3);
    });

    it("should block requests when rate limit is exceeded", () => {
      const ip = "192.168.1.2";
      const limit = 3;

      for (let i = 0; i < limit; i++) {
        const res = checkEdgeRateLimit(ip, "auth", limit, 60_000);
        expect(res.allowed).toBe(true);
      }

      // 4th request exceeds the limit of 3
      const blocked = checkEdgeRateLimit(ip, "auth", limit, 60_000);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.limit).toBe(3);
    });

    it("should isolate limits between different IP addresses", () => {
      const ipA = "10.0.0.1";
      const ipB = "10.0.0.2";

      // Exhaust IP A quota
      for (let i = 0; i < 3; i++) {
        checkEdgeRateLimit(ipA, "order", 3, 60_000);
      }
      expect(checkEdgeRateLimit(ipA, "order", 3, 60_000).allowed).toBe(false);

      // IP B should still have full quota
      const resB = checkEdgeRateLimit(ipB, "order", 3, 60_000);
      expect(resB.allowed).toBe(true);
      expect(resB.remaining).toBe(2);
    });

    it("should isolate limits between different categories for the same IP", () => {
      const ip = "10.0.0.5";

      // Exhaust auth quota
      for (let i = 0; i < 2; i++) {
        checkEdgeRateLimit(ip, "auth", 2, 60_000);
      }
      expect(checkEdgeRateLimit(ip, "auth", 2, 60_000).allowed).toBe(false);

      // Order quota for same IP should still be allowed
      const resOrder = checkEdgeRateLimit(ip, "order", 5, 60_000);
      expect(resOrder.allowed).toBe(true);
      expect(resOrder.remaining).toBe(4);
    });

    it("should reset counter after the time window expires", () => {
      const ip = "10.0.0.9";
      const now = Date.now();

      vi.spyOn(Date, "now").mockReturnValue(now);
      checkEdgeRateLimit(ip, "auth", 1, 10_000);
      expect(checkEdgeRateLimit(ip, "auth", 1, 10_000).allowed).toBe(false);

      // Fast-forward past windowMs
      vi.spyOn(Date, "now").mockReturnValue(now + 11_000);
      const afterExpiry = checkEdgeRateLimit(ip, "auth", 1, 10_000);
      expect(afterExpiry.allowed).toBe(true);
      expect(afterExpiry.remaining).toBe(0);
    });
  });

  describe("extractClientIp Header Parsing", () => {
    it("should prioritize Cloudflare cf-connecting-ip", () => {
      const headers = new Headers({
        "cf-connecting-ip": "203.0.113.195",
        "x-forwarded-for": "198.51.100.1, 192.0.2.1",
        "x-real-ip": "198.51.100.1",
      });
      expect(extractClientIp(headers)).toBe("203.0.113.195");
    });

    it("should parse the client IP from x-forwarded-for chain when CF header is missing", () => {
      const headers = new Headers({
        "x-forwarded-for": "198.51.100.42, 10.0.0.1, 172.16.0.1",
      });
      expect(extractClientIp(headers)).toBe("198.51.100.42");
    });

    it("should fallback to x-real-ip if x-forwarded-for is missing", () => {
      const headers = new Headers({
        "x-real-ip": "198.51.100.99",
      });
      expect(extractClientIp(headers)).toBe("198.51.100.99");
    });

    it("should default to 127.0.0.1 if no proxy headers are present", () => {
      const headers = new Headers();
      expect(extractClientIp(headers)).toBe("127.0.0.1");
    });
  });

  describe("Next.js Middleware Rate Limiting Integration", () => {
    it("should return HTTP 429 Too Many Requests when auth rate limit is exceeded in middleware", async () => {
      const clientIp = "198.51.100.77";

      // 30 requests allowed for auth
      for (let i = 0; i < 30; i++) {
        const req = new NextRequest("https://app.onton.live/api/v1/auth/telegram", {
          method: "POST",
          headers: {
            "cf-connecting-ip": clientIp,
            "content-type": "application/json",
          },
        });
        const res = middleware(req);
        expect(res.status).toBe(200);
      }

      // 31st request should be rejected by Edge rate limiter
      const blockedReq = new NextRequest("https://app.onton.live/api/v1/auth/telegram", {
        method: "POST",
        headers: {
          "cf-connecting-ip": clientIp,
          "content-type": "application/json",
        },
      });

      const blockedRes = middleware(blockedReq);
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.headers.get("Retry-After")).toBeDefined();
      expect(blockedRes.headers.get("X-RateLimit-Limit")).toBe("30");
      expect(blockedRes.headers.get("X-RateLimit-Remaining")).toBe("0");

      const body = await blockedRes.json();
      expect(body.error).toBe("too_many_requests");
    });

    it("should return HTTP 429 when order rate limit is exceeded in middleware", async () => {
      const clientIp = "198.51.100.88";

      // 20 requests allowed for orders
      for (let i = 0; i < 20; i++) {
        const req = new NextRequest("https://app.onton.live/api/v1/order", {
          method: "POST",
          headers: {
            "cf-connecting-ip": clientIp,
            "content-type": "application/json",
          },
        });
        const res = middleware(req);
        // It might be 401 or pass through depending on apiKey, but not 429
        expect(res.status).not.toBe(429);
      }

      // 21st request should be blocked with 429
      const blockedReq = new NextRequest("https://app.onton.live/api/v1/order", {
        method: "POST",
        headers: {
          "cf-connecting-ip": clientIp,
          "content-type": "application/json",
        },
      });

      const blockedRes = middleware(blockedReq);
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.headers.get("X-RateLimit-Limit")).toBe("20");
    });
  });
});
