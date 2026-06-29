import React, { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2, ExternalLink } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { toast } from "@/components/ui/use-toast";
import { authCallbackUrl } from "@/lib/auth-redirect";
import { completeSignIn } from "@/lib/complete-sign-in";
import {
  buildTermsAcceptanceMetadata,
  stageTermsAcceptanceForOAuth,
} from "@/lib/terms-acceptance";
import { APP_NAME } from "@/lib/brand";
import usePageMeta from "@/hooks/usePageMeta";
import TurnstileWidget from "@/components/auth/TurnstileWidget";
import { verifyTurnstileToken } from "@/lib/turnstile-api";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || "";

export default function Register() {
  usePageMeta({
    title: `Start free trial — ${APP_NAME}`,
    description: `Create your ${APP_NAME} account. Church live streaming on your website with a 10-day free trial — no credit card required.`,
    path: "/register",
  });
  const { isAuthenticated, isLoadingAuth, authChecked } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  const turnstileRequired = Boolean(TURNSTILE_SITE_KEY);
  const turnstileReady = !turnstileRequired || Boolean(turnstileToken);

  const ensureTurnstile = async () => {
    if (!turnstileRequired) return;
    if (!turnstileToken) {
      throw new Error("Please complete the security check below.");
    }
    await verifyTurnstileToken(turnstileToken);
  };

  if (!isLoadingAuth && authChecked && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!acceptedTerms) {
      setError("Please accept the Terms of Use and Privacy Policy to continue.");
      return;
    }
    setLoading(true);
    try {
      await ensureTurnstile();
      stageTermsAcceptanceForOAuth();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: authCallbackUrl(),
          data: buildTermsAcceptanceMetadata(),
        },
      });
      if (error) throw error;
      if (data.session) {
        await completeSignIn({
          userId: data.user?.id,
          recordTerms: true,
          acceptanceMethod: 'email',
        });
        return;
      }
      setShowVerify(true);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: "signup",
      });
      if (error) throw error;
      await completeSignIn({
        userId: data.user?.id,
        recordTerms: true,
        acceptanceMethod: 'email',
      });
    } catch (err) {
      setError(err.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: authCallbackUrl() },
      });
      if (error) throw error;
      toast({
        title: "Email sent",
        description: "Check your inbox for a new confirmation link or code.",
      });
    } catch (err) {
      setError(err.message || "Failed to resend email");
    }
  };

  const handleGoogle = async () => {
    setError("");
    if (!acceptedTerms) {
      setError("Please accept the Terms of Use and Privacy Policy to continue.");
      return;
    }
    setLoading(true);
    try {
      await ensureTurnstile();
      stageTermsAcceptanceForOAuth();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: authCallbackUrl(),
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message || "Google sign-in failed");
      setLoading(false);
    }
  };

  if (showVerify) {
    return (
      <AuthLayout
        icon={Mail}
        title="Check your email"
        subtitle={`We sent a confirmation to ${email}`}
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="mb-6 space-y-3 rounded-lg border border-border/50 bg-secondary/30 p-4 text-sm text-muted-foreground">
          <p className="flex items-start gap-2">
            <ExternalLink className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
            <span>
              <strong className="text-foreground">Most common:</strong> open the email and click
              the <strong className="text-foreground">Confirm your mail</strong> link. You should
              land back on this app, logged in.
            </span>
          </p>
          <p>
            If the link looks broken, add this URL in Supabase → Authentication → URL
            Configuration → Redirect URLs:{" "}
            <span className="font-mono text-xs text-foreground">{authCallbackUrl()}</span>
          </p>
        </div>

        <p className="mb-3 text-center text-xs text-muted-foreground">
          Email shows a 6-digit code instead? Enter it here:
        </p>
        <div className="mb-6 flex justify-center">
          <InputOTP
            maxLength={6}
            value={otpCode}
            onChange={setOtpCode}
            autoComplete="one-time-code"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button
          className="w-full h-12 font-medium"
          onClick={handleVerify}
          disabled={loading || otpCode.length < 6}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify with code"
          )}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Didn't receive it?{" "}
          <button onClick={handleResend} className="text-primary font-medium hover:underline">
            Resend email
          </button>
        </p>
        <p className="text-center text-sm text-muted-foreground mt-3">
          Already confirmed?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Log in
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Start your church trial"
      subtitle="10 days free — no credit card. Set up before Sunday."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-border/50 bg-secondary/20 p-4">
        <Checkbox
          id="accept-terms"
          checked={acceptedTerms}
          onCheckedChange={(value) => setAcceptedTerms(value === true)}
        />
        <label htmlFor="accept-terms" className="text-sm leading-relaxed text-muted-foreground">
          I agree to the{" "}
          <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Terms of Use
          </Link>{" "}
          and{" "}
          <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          . I understand I am solely responsible for the content I stream, including copyright
          compliance.
        </label>
      </div>

      {turnstileRequired ? (
        <div className="mb-6 flex justify-center">
          <TurnstileWidget
            siteKey={TURNSTILE_SITE_KEY}
            onVerify={setTurnstileToken}
            onExpire={() => setTurnstileToken("")}
            onError={() => setTurnstileToken("")}
          />
        </div>
      ) : null}

      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium mb-6"
        onClick={handleGoogle}
        disabled={loading || !acceptedTerms || !turnstileReady}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        ) : (
          <GoogleIcon className="w-5 h-5 mr-2" />
        )}
        Continue with Google
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button
          type="submit"
          className="w-full h-12 font-medium"
          disabled={loading || !acceptedTerms || !turnstileReady}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}