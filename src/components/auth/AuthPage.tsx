/**
 * AuthPage Component
 * 
 * Handles login, registration, and forgot password flows.
 */

import { useState, FormEvent, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authService } from "@/api/services";
import { refreshCsrfToken } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, Shield, Warehouse, Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import { toast } from "sonner";
import type { User } from "@/types";

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
      <div className="space-y-6">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
          <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
            Your workshop.
          </span>
          <br />
          <span className="bg-gradient-to-r from-brand-800 to-[#FFC107] bg-clip-text text-transparent">
            Always earning.
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-gray-400 max-w-lg leading-relaxed">
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

interface LoginFormData {
  email: string;
  password: string;
}

interface LoginFormProps {
  form: LoginFormData;
  setForm: (form: LoginFormData) => void;
  error: string;
  isPending: boolean;
  onSubmit: () => void;
  onForgot: () => void;
  onRegister: () => void;
}

function LoginForm({ form, setForm, error, isPending, onSubmit, onForgot, onRegister }: LoginFormProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
      </div>
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}
      <Button type="submit" className="w-full bg-brand-800 hover:bg-brand-900" disabled={isPending}>
        {isPending ? 'Signing in...' : 'Sign In'}
      </Button>
      <div className="flex items-center justify-between text-sm mt-2">
        <Button type="button" variant="link" className="px-0" onClick={onForgot}>
          Forgot your password?
        </Button>
        <Button type="button" variant="link" className="px-0" onClick={onRegister}>
          Need an account? Register
        </Button>
      </div>
    </form>
  );
}

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
}

interface RegisterFormProps {
  form: RegisterFormData;
  setForm: (form: RegisterFormData) => void;
  error: string;
  isPending: boolean;
  onSubmit: () => void;
  onLogin: () => void;
}

function RegisterForm({ form, setForm, error, isPending, onSubmit, onLogin }: RegisterFormProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <Input
          id="name"
          type="text"
          required
          autoComplete="name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-email">Email</Label>
        <Input
          id="register-email"
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-password">Password</Label>
        <Input
          id="register-password"
          type="password"
          required
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <p className="text-xs text-gray-500">
          Min 8 characters with uppercase, lowercase, number, and special character
        </p>
      </div>
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}
      <Button type="submit" className="w-full bg-brand-800 hover:bg-brand-900" disabled={isPending}>
        {isPending ? 'Creating account...' : 'Create account'}
      </Button>
      <div className="text-center text-sm mt-2">
        <span className="mr-1">Already have an account?</span>
        <Button type="button" variant="link" className="px-0" onClick={onLogin}>
          Sign in
        </Button>
      </div>
    </form>
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
        {isPending ? 'Sending reset link...' : 'Send reset link'}
      </Button>
      <div className="text-center text-sm mt-2">
        <Button type="button" variant="link" className="px-0" onClick={onBack}>
          Back to sign in
        </Button>
      </div>
    </form>
  );
}

type AuthMode = 'login' | 'register' | 'forgot';

interface ApiError {
  data?: { message?: string };
  message?: string;
  response?: { data?: { message?: string; error?: string } };
}

export default function AuthPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const ONBOARDING_STORAGE_KEY = 'spannerwork:onboarding';

  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [loginForm, setLoginForm] = useState<LoginFormData>({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [registerForm, setRegisterForm] = useState<RegisterFormData>({ name: "", email: "", password: "" });
  const [registerError, setRegisterError] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);

  const clearErrors = () => {
    setLoginError("");
    setRegisterError("");
    setForgotError("");
    setForgotMessage("");
  };

  const getSafeRedirect = (): string | null => {
    const params = new URLSearchParams(location.search);
    const redirect = params.get('redirect');
    if (!redirect) {
      return null;
    }
    const isSafeInternalRedirect = redirect.startsWith('/') && !redirect.startsWith('//');
    return isSafeInternalRedirect ? redirect : null;
  };

  const shouldForceOnboarding = (user: User): boolean => {
    const isProfileCompleteForJob = !!(
      user &&
      user.emailVerified &&
      user.name &&
      (user.locationAddress || user.postcode)
    );

    const hasOnboardingFlag = localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1';
    if (hasOnboardingFlag && isProfileCompleteForJob) {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);
      return false;
    }

    if (hasOnboardingFlag) {
      return true;
    }

    return !!(
      user &&
      (!user.emailVerified || !user.name || !(user.locationAddress || user.postcode))
    );
  };

  const handleAuthSuccess = async () => {
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      const currentUserResponse = await authService.getCurrentUser();
      const redirect = getSafeRedirect();
      if (currentUserResponse?.user && shouldForceOnboarding(currentUserResponse.user)) {
        navigate('/profile?welcome=1', { replace: true });
        return;
      }
      navigate(redirect || '/feed', { replace: true });
    } catch {
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        const currentUserResponse = await authService.getCurrentUser();
        const redirect = getSafeRedirect();
        if (currentUserResponse?.user && shouldForceOnboarding(currentUserResponse.user)) {
          navigate('/profile?welcome=1', { replace: true });
          return;
        }
        navigate(redirect || '/feed', { replace: true });
      } catch {
        setIsRedirecting(false);
        setLoginError('Sign-in didn\'t complete. Please refresh and try again.');
      }
    }
  };

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginFormData) => authService.login(credentials),
    onSuccess: async (data) => {
      setIsRedirecting(true);
      queryClient.setQueryData(['currentUser'], { user: data.user });
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

  const registerMutation = useMutation({
    mutationFn: (data: RegisterFormData) => authService.register(data),
    onSuccess: async () => {
      setIsRedirecting(true);
      try {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
        await refreshCsrfToken();
        const currentUser = await authService.getCurrentUser();
        queryClient.setQueryData(['currentUser'], currentUser);
        toast.success("Welcome to SpannerWork! Complete your profile to post a job.");
        navigate('/profile?welcome=1', { replace: true });
      } catch {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
        queryClient.setQueryData(['currentUser'], null);
        setIsRedirecting(false);
        setRegisterError('Account created, but sign-in didn\'t complete. Please refresh and try signing in.');
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

  const forgotPasswordMutation = useMutation({
    mutationFn: (email: string) => authService.forgotPassword(email),
    onSuccess: () => {
      setForgotError("");
      setForgotMessage("If the email exists, a password reset link has been sent.");
    },
    onError: () => {
      setForgotError("");
      setForgotMessage("If the email exists, a password reset link has been sent.");
    },
  });

  const switchToMode = (mode: AuthMode, emailCarryOver?: string) => {
    clearErrors();
    setAuthMode(mode);
    if (mode === "register" && emailCarryOver) {
      setRegisterForm({ name: "", email: emailCarryOver, password: "" });
    }
    if (mode === "login" && emailCarryOver) {
      setLoginForm({ email: emailCarryOver, password: "" });
    }
    if (mode === "forgot" && emailCarryOver) {
      setForgotEmail(emailCarryOver);
    }
  };

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

  return (
    <div className="min-h-screen bg-[#0A0F1C] relative overflow-hidden">
      <SEO
        title="Sign in or join SpannerWork"
        description="Sign in or create your free SpannerWork account to post jobs, rent tools and share workshop space."
        keywords="SpannerWork login, create account, mechanics marketplace"
      />
      
      <div className="absolute inset-0 bg-gradient-to-br from-brand-800/20 via-transparent to-[#FFC107]/10" />
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      />
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-800 rounded-full blur-[120px] opacity-20" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#FFC107] rounded-full blur-[120px] opacity-10" />

      <div className="relative max-w-7xl mx-auto px-4 py-12 md:py-20 min-h-screen flex items-center">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="absolute top-4 left-4 text-gray-400 hover:text-white hover:bg-white/10"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Button>

        <div className="grid gap-12 lg:gap-16 md:grid-cols-2 items-center w-full">
          <AuthHero />

          <div className="w-full max-w-md mx-auto lg:ml-auto">
            <Card className="relative border-none bg-white shadow-2xl shadow-black/20 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-800/5 to-[#FFC107]/5 pointer-events-none" />
              
              <CardHeader className="relative space-y-3 pb-6">
                <div className="flex justify-center mb-2">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-brand-800 to-brand-900 shadow-lg shadow-brand-800/30">
                    <Wrench className="w-6 h-6 text-white" />
                  </div>
                </div>
                <CardTitle className="text-2xl md:text-3xl font-bold text-center text-gray-900">
                  {authMode === "login" && "Welcome back"}
                  {authMode === "register" && "Get started today"}
                  {authMode === "forgot" && "Reset password"}
                </CardTitle>
                <p className="text-sm text-gray-500 text-center">
                  {authMode === "login" && "Sign in to access your SpannerWork dashboard"}
                  {authMode === "register" && "Start earning more from your workshop and tools"}
                  {authMode === "forgot" && "We'll send you a link to reset your password"}
                </p>
              </CardHeader>

              <CardContent>
                {authMode === "login" && (
                  <LoginForm
                    form={loginForm}
                    setForm={setLoginForm}
                    error={loginError}
                    isPending={loginMutation.isPending}
                    onSubmit={() => { clearErrors(); loginMutation.mutate(loginForm); }}
                    onForgot={() => switchToMode("forgot", loginForm.email)}
                    onRegister={() => switchToMode("register", loginForm.email)}
                  />
                )}
                {authMode === "register" && (
                  <RegisterForm
                    form={registerForm}
                    setForm={setRegisterForm}
                    error={registerError}
                    isPending={registerMutation.isPending}
                    onSubmit={() => { clearErrors(); registerMutation.mutate(registerForm); }}
                    onLogin={() => switchToMode("login", registerForm.email)}
                  />
                )}
                {authMode === "forgot" && (
                  <ForgotPasswordForm
                    email={forgotEmail}
                    setEmail={setForgotEmail}
                    error={forgotError}
                    message={forgotMessage}
                    isPending={forgotPasswordMutation.isPending}
                    onSubmit={() => { clearErrors(); if (forgotEmail) forgotPasswordMutation.mutate(forgotEmail); }}
                    onBack={() => switchToMode("login")}
                  />
                )}
              </CardContent>
            </Card>

            <p className="mt-4 text-xs text-gray-300 text-center">
              By continuing you agree to our{" "}
              <button type="button" className="underline underline-offset-2 text-orange-200 hover:text-white" onClick={() => navigate("/Terms")}>
                Terms
              </button>{" "}
              and{" "}
              <button type="button" className="underline underline-offset-2 text-orange-200 hover:text-white" onClick={() => navigate("/Privacy")}>
                Privacy Policy
              </button>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
