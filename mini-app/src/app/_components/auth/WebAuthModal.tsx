"use client";

import OntonDialog from "@/components/OntonDialog";
import { useUserStore } from "@/context/store/user.store";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

interface WebAuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (user: any) => void;
  title?: string;
  subtitle?: string;
}

export const WebAuthModal: React.FC<WebAuthModalProps> = ({
  open,
  onClose,
  onSuccess,
  title = "Sign in to ONTON",
  subtitle = "Enter your email to receive a secure login code.",
}) => {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { setUser } = useUserStore();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/auth/email/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send verification code");
      }

      toast.success("Verification code sent to your email");
      setStep("otp");
    } catch (err: any) {
      toast.error(err.message || "Failed to send code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length < 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/auth/email/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Invalid verification code");
      }

      // Store platform token in localStorage for client-side API requests
      if (typeof window !== "undefined" && data.token) {
        localStorage.setItem("onton_token", data.token);
        // Also set cookie if not already set by Set-Cookie header
        document.cookie = `onton_token=${data.token}; path=/; max-age=2592000; SameSite=Lax`;
      }

      if (data.user) {
        setUser(data.user);
      }

      toast.success("Welcome to ONTON!");
      onSuccess?.(data.user);
      onClose();
      // Reset state for next time
      setStep("email");
      setCode("");
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <OntonDialog open={open} onClose={onClose} title={step === "email" ? title : "Verify Your Email"}>
      <div className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          {step === "email" ? subtitle : `We sent a 6-digit code to ${email}`}
        </p>

        {step === "email" ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label htmlFor="auth-email-input" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="auth-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@example.com"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !email}
              className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-sm transition shadow flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Continue with Email</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label htmlFor="auth-code-input" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                6-Digit Verification Code
              </label>
              <div className="relative">
                <ShieldCheck className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="auth-code-input"
                  type="text"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white text-center font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || code.length < 6}
              className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-sm transition shadow flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Verify & Sign In</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
              }}
              className="w-full text-center text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 pt-2 transition"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </OntonDialog>
  );
};

export default WebAuthModal;
