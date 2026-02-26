/**
 * AuthPage Component
 *
 * Email-first authentication flow:
 * 1. User enters email
 * 2. We check if account exists
 * 3. Returning users see "Welcome back" with streamlined login
 * 4. New users go through signup wizard
 */

import { useState, FormEvent, ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authService } from "@/api/services";
import { refreshCsrfToken } from "@/api/client";
import type { CheckEmailResponse } from "@/api/services/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, Shield, Warehouse, Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import { toast } from "sonner";
import type { User } from "@/types";

import { EmailEntryForm } from "./EmailEntryForm";
import { WelcomeBackForm } from "./WelcomeBackForm";
import { SignupWizard, type SignupData } from "./SignupWizard";

// Storage keys
const ONBOARDING_STORAGE_KEY = "spannerwork:onboarding";
const REMEMBERED_EMAIL_KEY = "spannerwork:remembered-email";

interface FeatureCardProps {
  icon: ReactNode;
  iconBg: string;
  shadowColor: string;
  borderHover: string;
  title: string;
  description: string;
}

function FeatureCard({ icon, iconBg, shadowColor, borderHover, title, description }: FeatureCardProps) {
  return (
    <div className={`group relative p-5 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 ${borderHover} transition-all duration-300`}>
      <div className="flex items-start gap-4">
        <div className={`p-2.5 rounded-xl ${iconBg} shadow-lg ${shadowColor}`}>
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-white mb-1">{title}</h3>
          <p className="text-sm text-gray-400">{description}</p>
        </div>
      </div>
    </div>
  );
}

function AuthHero() {
  return (
    <div className="space-y-8">
      <div className="space-y-6 text-center md:text-left">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
          <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
            Your workshop.
          </span>
          <br />
          <span className="bg-gradient-to-r from-brand-800 to-[#FFC107] bg-clip-text text-transparent">
            Always earning.
          </span>
        </h1>

        <p className="text-lg md:text-xl text-gray-400 max-w-lg leading-relaxed mx-auto md:mx-0">
          List tools, rent bays, win jobs. The marketplace built for independent mechanics who want their kit working as hard as they do.
        </p>
      </div>

      <div className="grid gap-4 max-w-lg">
        <FeatureCard
          icon={<Wrench className="w-5 h-5 text-white" />}
          iconBg="bg-gradient-to-br from-brand-800 to-brand-900"
          shadowColor="shadow-brand-800/20"
          borderHover="hover:border-brand-800/50"
          title="Specialist tools on demand"
          description="Share diagnostics, alignment kits and specialist tools with verified mechanics nearby."
        />

        <FeatureCard
          icon={<Warehouse className="w-5 h-5 text-gray-900" />}
          iconBg="bg-gradient-to-br from-[#FFC107] to-[#FFA000]"
          shadowColor="shadow-[#FFC107]/20"
          borderHover="hover:border-[#FFC107]/50"
          title="Workshop space that pays"
          description="Rent out empty bays, ramps or lifts by the hour when your schedule has a gap."
        />

        <FeatureCard
          icon={<Shield className="w-5 h-5 text-white" />}
          iconBg="bg-gradient-to-br from-gray-700 to-gray-800"
          shadowColor=""
          borderHover="hover:border-white/30"
          title="Reviews & verified members"
          description="Rating system and ID verification keep quality high and time-wasters out."
        />
      </div>
    </div>
  );
}

interface ForgotPasswordFormProps {
  email: string;
  setEmail: (email: string) => void;
  error: string;
  message: string;
  isPending: boolean;
  onSubmit: () => void;
  onBack: () => void;
}

function ForgotPasswordForm({ email, setEmail, error, message, isPending, onSubmit, onBack }: ForgotPasswordFormProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="forgot-email">Email</Label>
        <Input
          id="forgot-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-red-600 font-medium text-center">{error}</p>}
      {message && <p className="text-sm text-green-700 font-medium text-center">{message}</p>}
      <Button type="submit" className="w-full bg-brand-800 hover:bg-brand-900" disabled={isPending}>
        {isPending ? "Sending reset link..." : "Send reset link"}
      </Button>
      <div className="text-center text-sm mt-2">
        <Button type="button" variant="link" className="px-0" onClick={onBack}>
          Back to sign in
        </Button>
      </div>
    </form>
  );
}

// Auth modes for email-first flow
type AuthMode = "email" | "login" | "register" | "forgot";

interface ApiError {
  data?: { message?: string };
  message?: string;
  response?: { data?: { message?: string; error?: string } };
}

export default function AuthPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  // Check for remembered email on mount
  const [rememberedEmail] = useState(() => {
    return localStorage.getItem(REMEMBERED_EMAIL_KEY) || "";
  });

  // State
  const [authMode, setAuthMode] = useState<AuthMode>("email");
  const [email, setEmail] = useState(rememberedEmail);
  const [emailCheckResult, setEmailCheckResult] = useState<CheckEmailResponse | null>(null);
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(!!rememberedEmail);
  const [loginError, setLoginError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [checkEmailError, setCheckEmailError] = useState("");

  // If we have a remembered email, auto-check on mount
  useEffect(() => {
    if (rememberedEmail && authMode === "email") {
      checkEmailMutation.mutate(rememberedEmail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearErrors = () => {
    setLoginError("");
    setRegisterError("");
    setForgotError("");
    setForgotMessage("");
    setCheckEmailError("");
  };

  const getSafeRedirect = (): string | null => {
    const params = new URLSearchParams(location.search);
    const redirect = params.get("redirect");
    if (!redirect) {
      return null;
    }
    const isSafeInternalRedirect = redirect.startsWith("/") && !redirect.startsWith("//");
    return isSafeInternalRedirect ? redirect : null;
  };

  const shouldForceOnboarding = (user: User): boolean => {
    const isProfileCompleteForJob = !!(
      user &&
      user.name &&
      (user.locationAddress || user.postcode)
    );

    const hasOnboardingFlag = localStorage.getItem(ONBOARDING_STORAGE_KEY) === "1";
    if (hasOnboardingFlag && isProfileCompleteForJob) {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);
      return false;
    }

    if (hasOnboardingFlag) {
      return true;
    }

    return !!(user && (!user.name || !(user.locationAddress || user.postcode)));
  };

  const handleAuthSuccess = async () => {
    // Store or clear remembered email
    if (rememberEmail && email) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      const currentUserResponse = await authService.getCurrentUser();
      const redirect = getSafeRedirect();
      if (currentUserResponse?.user && !currentUserResponse.user.emailVerified) {
        navigate("/verification", { replace: true });
        return;
      }
      if (currentUserResponse?.user && shouldForceOnboarding(currentUserResponse.user)) {
        navigate("/profile?welcome=1", { replace: true });
        return;
      }
      navigate(redirect || "/feed", { replace: true });
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        const currentUserResponse = await authService.getCurrentUser();
        const redirect = getSafeRedirect();
        if (currentUserResponse?.user && !currentUserResponse.user.emailVerified) {
          navigate("/verification", { replace: true });
          return;
        }
        if (currentUserResponse?.user && shouldForceOnboarding(currentUserResponse.user)) {
          navigate("/profile?welcome=1", { replace: true });
          return;
        }
        navigate(redirect || "/feed", { replace: true });
      } catch {
        setIsRedirecting(false);
        setLoginError("Sign-in didn't complete. Please refresh and try again.");
      }
    }
  };

  // Check email mutation
  // Note: Backend always returns exists: true to prevent email enumeration
  // We use the presence of firstName to determine if this is a returning user
  const checkEmailMutation = useMutation({
    mutationFn: (emailToCheck: string) => authService.checkEmail(emailToCheck),
    onSuccess: (data) => {
      setEmailCheckResult(data);
      // If we have personalization data (firstName), show login for returning user
      // Otherwise show registration for new users
      if (data.firstName) {
        setAuthMode("login");
      } else {
        setAuthMode("register");
      }
    },
    onError: (error: ApiError) => {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Unable to check email. Please try again.";
      setCheckEmailError(message);
    },
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      authService.login(credentials),
    onSuccess: async (data) => {
      setIsRedirecting(true);
      queryClient.setQueryData(["currentUser"], { user: data.user });
      await refreshCsrfToken();
      handleAuthSuccess();
    },
    onError: (error: ApiError) => {
      const message =
        error?.data?.message ||
        error?.message ||
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Unable to sign in. Please check your details and try again.";
      setLoginError(message);
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: (data: SignupData) =>
      authService.register({
        email: data.email,
        password: data.password,
        name: data.name,
      }),
    onSuccess: async () => {
      setIsRedirecting(true);
      try {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
        // Store remembered email if opted in
        if (rememberEmail && email) {
          localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
        }
        await refreshCsrfToken();
        const currentUser = await authService.getCurrentUser();
        queryClient.setQueryData(["currentUser"], currentUser);
        toast.success(
          "Welcome to SpannerWork! Please verify your account to start messaging and booking."
        );
        navigate("/verification", { replace: true });
      } catch {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
        queryClient.setQueryData(["currentUser"], null);
        setIsRedirecting(false);
        setRegisterError(
          "Account created, but sign-in didn't complete. Please refresh and try signing in."
        );
      }
    },
    onError: (error: ApiError) => {
      const message =
        error?.data?.message ||
        error?.message ||
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Unable to register. Please check your details and try again.";
      setRegisterError(message);
    },
  });

  // Forgot password mutation
  const forgotPasswordMutation = useMutation({
    mutationFn: (emailToReset: string) => authService.forgotPassword(emailToReset),
    onSuccess: () => {
      setForgotError("");
      setForgotMessage("If the email exists, a password reset link has been sent.");
    },
    onError: () => {
      setForgotError("");
      setForgotMessage("If the email exists, a password reset link has been sent.");
    },
  });

  const handleEmailSubmit = () => {
    clearErrors();
    if (email.trim()) {
      checkEmailMutation.mutate(email.trim().toLowerCase());
    }
  };

  const handleLoginSubmit = () => {
    clearErrors();
    loginMutation.mutate({ email, password });
  };

  const handleSignupComplete = (data: SignupData) => {
    clearErrors();
    registerMutation.mutate(data);
  };

  const handleSwitchEmail = () => {
    clearErrors();
    setAuthMode("email");
    setEmail("");
    setPassword("");
    setEmailCheckResult(null);
    localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  };

  const handleForgotPassword = () => {
    clearErrors();
    setForgotEmail(email);
    setAuthMode("forgot");
  };

  const handleBackFromForgot = () => {
    clearErrors();
    if (emailCheckResult?.exists) {
      setAuthMode("login");
    } else {
      setAuthMode("email");
    }
  };

  // Loading state
  if (isRedirecting) {
    return (
      <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-brand-800 mx-auto mb-4" />
          <p className="text-gray-400">Signing you in...</p>
        </div>
      </div>
    );
  }

  // Card titles and descriptions based on mode
  const cardContent = {
    email: {
      title: "Get started",
      description: "Enter your email to sign in or create an account",
    },
    login: {
      title: emailCheckResult?.firstName
        ? `Welcome back, ${emailCheckResult.firstName}!`
        : "Welcome back",
      description: "Enter your password to sign in",
    },
    register: {
      title: "Create your account",
      description: "Join thousands of mechanics earning more",
    },
    forgot: {
      title: "Reset password",
      description: "We'll send you a link to reset your password",
    },
  };

  return (
    <div className="min-h-screen bg-[#0A0F1C] relative overflow-hidden">
      <SEO
        title="Sign in or join SpannerWork"
        description="Sign in or create your free SpannerWork account to post jobs, rent tools and share workshop space."
        keywords="SpannerWork login, create account, mechanics marketplace"
      />

      <div className="absolute inset-0 bg-gradient-to-br from-brand-800/20 via-transparent to-[#FFC107]/10" />
      <div className="absolute inset-0 opacity-[0.015] bg-grid-pattern" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-800 rounded-full blur-[120px] opacity-20" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#FFC107] rounded-full blur-[120px] opacity-10" />

      <div className="relative max-w-7xl mx-auto px-4 pt-14 pb-6 md:py-20 min-h-screen flex items-start md:items-center">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="absolute top-3 left-3 md:top-4 md:left-4 text-gray-400 hover:text-white hover:bg-white/10 text-sm"
        >
          <svg
            className="w-4 h-4 mr-1.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back
        </Button>

        <div className="grid gap-8 md:gap-12 lg:gap-16 md:grid-cols-2 items-center w-full">
          {/* Hero - shown after form on mobile, before on desktop */}
          <div className="order-2 md:order-1">
            <AuthHero />
          </div>

          {/* Auth form - shown first on mobile */}
          <div className="w-full max-w-md mx-auto lg:ml-auto order-1 md:order-2">
            <Card className="relative border-none bg-white shadow-2xl shadow-black/20 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-800/5 to-[#FFC107]/5 pointer-events-none" />

              <CardHeader className="relative space-y-3 pb-6">
                <div className="flex justify-center mb-2">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-brand-800 to-brand-900 shadow-lg shadow-brand-800/30">
                    <Wrench className="w-6 h-6 text-white" />
                  </div>
                </div>
                <CardTitle className="text-2xl md:text-3xl font-bold text-center text-gray-900">
                  {cardContent[authMode].title}
                </CardTitle>
                <p className="text-sm text-gray-500 text-center">
                  {cardContent[authMode].description}
                </p>
              </CardHeader>

              <CardContent>
                {authMode === "email" && (
                  <EmailEntryForm
                    email={email}
                    setEmail={setEmail}
                    error={checkEmailError}
                    isPending={checkEmailMutation.isPending}
                    onSubmit={handleEmailSubmit}
                  />
                )}

                {authMode === "login" && (
                  <WelcomeBackForm
                    email={email}
                    firstName={emailCheckResult?.firstName}
                    avatarUrl={emailCheckResult?.avatarUrl}
                    password={password}
                    setPassword={setPassword}
                    rememberEmail={rememberEmail}
                    setRememberEmail={setRememberEmail}
                    error={loginError}
                    isPending={loginMutation.isPending}
                    onSubmit={handleLoginSubmit}
                    onForgot={handleForgotPassword}
                    onSwitchEmail={handleSwitchEmail}
                  />
                )}

                {authMode === "register" && (
                  <SignupWizard
                    email={email}
                    onComplete={handleSignupComplete}
                    onBack={handleSwitchEmail}
                    isPending={registerMutation.isPending}
                    error={registerError}
                  />
                )}

                {authMode === "forgot" && (
                  <ForgotPasswordForm
                    email={forgotEmail}
                    setEmail={setForgotEmail}
                    error={forgotError}
                    message={forgotMessage}
                    isPending={forgotPasswordMutation.isPending}
                    onSubmit={() => {
                      clearErrors();
                      if (forgotEmail) forgotPasswordMutation.mutate(forgotEmail);
                    }}
                    onBack={handleBackFromForgot}
                  />
                )}
              </CardContent>
            </Card>

            <p className="mt-4 text-xs text-gray-300 text-center">
              By continuing you agree to our{" "}
              <button
                type="button"
                className="underline underline-offset-2 text-brand-200 hover:text-white"
                onClick={() => navigate("/Terms")}
              >
                Terms
              </button>{" "}
              and{" "}
              <button
                type="button"
                className="underline underline-offset-2 text-brand-200 hover:text-white"
                onClick={() => navigate("/Privacy")}
              >
                Privacy Policy
              </button>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
