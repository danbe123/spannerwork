/**
 * Magic Link Verification Page
 *
 * Handles passwordless authentication via email magic links:
 * - Verifies the token from the URL query parameter
 * - Establishes user session on successful verification
 * - Redirects to onboarding or feed based on profile completion
 * - Shows expiration message for invalid/expired tokens
 */

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authService } from "@/api/services";
import { refreshCsrfToken } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Wrench } from "lucide-react";
import SEO from "@/components/SEO";

type VerificationState = "verifying" | "success" | "error";

export default function MagicLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const token = searchParams.get("token");

  const [state, setState] = useState<VerificationState>("verifying");
  const [errorMessage, setErrorMessage] = useState("");

  const verifyMutation = useMutation({
    mutationFn: (verifyToken: string) => authService.verifyMagicLink(verifyToken),
    onSuccess: async (data) => {
      setState("success");
      queryClient.setQueryData(["currentUser"], { user: data.user });
      await refreshCsrfToken();

      // Brief delay to show success state before redirecting
      setTimeout(() => {
        // New users without name/location go to onboarding
        const needsOnboarding =
          !data.user.name || !(data.user.locationAddress || data.user.postcode);

        if (needsOnboarding) {
          navigate("/profile?welcome=1", { replace: true });
        } else {
          navigate("/feed", { replace: true });
        }
      }, 1500);
    },
    onError: (error: Error) => {
      setState("error");
      setErrorMessage(error.message || "Invalid or expired magic link");
    },
  });

  useEffect(() => {
    if (token) {
      verifyMutation.mutate(token);
    } else {
      setState("error");
      setErrorMessage("No token provided");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center p-4">
      <SEO
        title="Signing you in - SpannerWork"
        description="Verifying your magic link..."
      />

      {/* Background decorations */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-800/20 via-transparent to-[#FFC107]/10" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-800 rounded-full blur-[120px] opacity-20" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#FFC107] rounded-full blur-[120px] opacity-10" />

      <Card className="relative w-full max-w-md border-none bg-white shadow-2xl shadow-black/20">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-brand-800 to-brand-900 shadow-lg shadow-brand-800/30">
              <Wrench className="w-6 h-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            {state === "verifying" && "Signing you in..."}
            {state === "success" && "You're in!"}
            {state === "error" && "Link expired"}
          </CardTitle>
        </CardHeader>

        <CardContent className="text-center">
          {state === "verifying" && (
            <div className="py-8">
              <Loader2 className="w-12 h-12 animate-spin text-brand-800 mx-auto mb-4" />
              <p className="text-gray-500">Verifying your magic link...</p>
            </div>
          )}

          {state === "success" && (
            <div className="py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Successfully signed in!</p>
              <p className="text-sm text-gray-400">Redirecting you now...</p>
            </div>
          )}

          {state === "error" && (
            <div className="py-6 space-y-4">
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <p className="text-gray-600">{errorMessage}</p>
              <p className="text-sm text-gray-400">
                Magic links expire after 15 minutes and can only be used once.
              </p>
              <div className="pt-4 space-y-3">
                <Button
                  className="w-full bg-brand-800 hover:bg-brand-900"
                  onClick={() => navigate("/profile")}
                >
                  Go to Sign In
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/")}
                >
                  Go to Homepage
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
