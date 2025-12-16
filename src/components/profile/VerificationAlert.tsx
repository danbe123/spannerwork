/**
 * VerificationAlert Component
 * 
 * Displays a prompt for users to verify their email/phone.
 */

import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface VerificationAlertProps {
  emailVerified?: boolean;
  phoneVerified?: boolean;
}

export default function VerificationAlert({ emailVerified, phoneVerified }: VerificationAlertProps) {
  const navigate = useNavigate();

  if (emailVerified && phoneVerified) {
    return null;
  }

  return (
    <Card className="border-none shadow-md mt-6 bg-amber-50">
      <CardContent className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-4">
        <div>
          <p className="text-sm font-medium text-amber-900">Build trust by verifying your account</p>
          <Alert className="mt-2 bg-amber-100 border-amber-200">
            <AlertDescription className="text-xs text-amber-900">
              {!emailVerified && !phoneVerified && (
                <>Verify your email and phone to unlock more features and boost your reputation.</>
              )}
              {emailVerified && !phoneVerified && (
                <>Add and verify your phone number to increase trust and visibility.</>
              )}
              {!emailVerified && phoneVerified && (
                <>Verify your email to receive important updates and build trust with other users.</>
              )}
            </AlertDescription>
          </Alert>
        </div>
        <Button
          size="sm"
          className="bg-brand-800 hover:bg-brand-900"
          onClick={() => navigate("/Verification")}
        >
          Manage verification
        </Button>
      </CardContent>
    </Card>
  );
}
