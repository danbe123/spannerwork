/**
 * WelcomeBackForm Component
 *
 * Personalized login form for returning users.
 * Shows their name/avatar and streamlined password entry.
 */

import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Lock, Mail, Check } from "lucide-react";
import { authService } from "@/api/services";
import { toast } from "sonner";

interface WelcomeBackFormProps {
  email: string;
  firstName?: string | null;
  avatarUrl?: string | null;
  password: string;
  setPassword: (password: string) => void;
  rememberEmail: boolean;
  setRememberEmail: (remember: boolean) => void;
  error: string;
  isPending: boolean;
  onSubmit: () => void;
  onForgot: () => void;
  onSwitchEmail: () => void;
}

export function WelcomeBackForm({
  email,
  firstName,
  avatarUrl,
  password,
  setPassword,
  rememberEmail,
  setRememberEmail,
  error,
  isPending,
  onSubmit,
  onForgot,
  onSwitchEmail,
}: WelcomeBackFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const magicLinkMutation = useMutation({
    mutationFn: () => authService.sendMagicLink(email),
    onSuccess: () => {
      setMagicLinkSent(true);
      toast.success("Login link sent! Check your email.");
    },
    onError: () => {
      toast.error("Failed to send login link. Please try again.");
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const displayName = firstName || email.split("@")[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* User Identity Section */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-800 to-brand-900 flex items-center justify-center text-white text-xl font-bold shadow-sm">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">
            {firstName ? `Welcome back, ${firstName}!` : "Welcome back!"}
          </p>
          <p className="text-sm text-gray-500 truncate">{email}</p>
        </div>
      </div>

      {/* Not You Link */}
      <div className="text-center">
        <button
          type="button"
          onClick={onSwitchEmail}
          className="text-sm text-brand-800 hover:text-brand-900 hover:underline"
        >
          Not you? Use a different email
        </button>
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <Label htmlFor="password" className="text-gray-700">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            autoFocus
            placeholder="Enter your password"
            className="pl-10 pr-10 h-12 text-base"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Remember Email Checkbox */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="remember"
          checked={rememberEmail}
          onCheckedChange={(checked) => setRememberEmail(checked === true)}
        />
        <label
          htmlFor="remember"
          className="text-sm text-gray-600 cursor-pointer select-none"
        >
          Remember my email on this device
        </label>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full h-12 bg-brand-800 hover:bg-brand-900 text-base font-semibold"
        disabled={isPending || !password}
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Signing in...
          </span>
        ) : (
          "Sign in"
        )}
      </Button>

      {/* Magic Link Option */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white text-gray-500">or</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full h-11"
        onClick={() => magicLinkMutation.mutate()}
        disabled={magicLinkMutation.isPending || magicLinkSent}
      >
        {magicLinkMutation.isPending ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            Sending...
          </span>
        ) : magicLinkSent ? (
          <span className="flex items-center gap-2 text-green-600">
            <Check className="w-4 h-4" />
            Check your email
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Email me a login link
          </span>
        )}
      </Button>

      {/* Forgot Password */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onForgot}
          className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
        >
          Forgot your password?
        </button>
      </div>
    </form>
  );
}
