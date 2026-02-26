/**
 * EmailEntryForm Component
 *
 * Initial email entry step for the email-first auth flow.
 * Checks if the email exists and routes to appropriate next step.
 */

import { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowRight } from "lucide-react";
import { SocialLoginButtons } from "./SocialLoginButtons";

interface EmailEntryFormProps {
  email: string;
  setEmail: (email: string) => void;
  error: string;
  isPending: boolean;
  onSubmit: () => void;
}

export function EmailEntryForm({ email, setEmail, error, isPending, onSubmit }: EmailEntryFormProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-gray-700">Email address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              className="pl-10 h-12 text-base"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-12 bg-brand-800 hover:bg-brand-900 text-base font-semibold"
          disabled={isPending || !email.trim()}
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Checking...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Continue
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </Button>
      </form>

      <SocialLoginButtons />
    </div>
  );
}
