import { useState, FormEvent, ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { authService } from "@/api/services";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ResetPasswordData {
  token: string;
  password: string;
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const resetMutation = useMutation({
    mutationFn: ({ token, password }: ResetPasswordData) => authService.resetPassword(token, password),
    onSuccess: () => {
      setError("");
      setSuccessMessage("Your password has been reset successfully. You can now sign in with your new password.");
      toast.success("Password reset successfully");
    },
    onError: (err: Error & { response?: { data?: { message?: string; error?: string } } }) => {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Unable to reset password. The link may be invalid or expired.";
      setSuccessMessage("");
      setError(message);
      toast.error(message);
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!token) {
      setError("Reset link is invalid. Please request a new password reset email.");
      return;
    }

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    resetMutation.mutate({ token, password });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <Card className="shadow-lg border-none">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Reset your password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 font-medium text-center">{error}</p>
              )}
              {successMessage && (
                <p className="text-sm text-green-700 font-medium text-center">{successMessage}</p>
              )}
              <Button
                type="submit"
                className="w-full bg-brand-800 hover:bg-brand-900"
                disabled={resetMutation.isPending}
              >
                {resetMutation.isPending ? "Resetting..." : "Reset password"}
              </Button>
              <div className="text-center text-sm mt-2">
                <Button
                  type="button"
                  variant="link"
                  className="px-0"
                  onClick={() => navigate("/Profile")}
                >
                  Back to sign in
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
