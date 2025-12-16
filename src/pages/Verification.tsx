import { useState, useEffect, ChangeEvent } from "react";
import { authService, uploadService } from "@/api/services";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Shield,
  Phone,
  Mail,
  CheckCircle,
  Loader2,
  Upload,
  Send
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User } from "@/types";

export default function Verification() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [insuranceDoc, setInsuranceDoc] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const { data: currentUserData, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => authService.getCurrentUser(),
  });

  const currentUser: User | undefined = currentUserData?.user;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) return;

    const verify = async () => {
      try {
        await authService.verifyEmail(token);
        toast.success("Email verified successfully!");
        queryClient.invalidateQueries({ queryKey: ['currentUser'] });
        void queryClient.refetchQueries({ queryKey: ['currentUser'] });
        try {
          localStorage.setItem('spannerwork:authUpdated', String(Date.now()));
        } catch {
          // ignore
        }
        window.dispatchEvent(new CustomEvent('auth:updated'));
      } catch (error: unknown) {
        const err = error as Error;
        toast.error(err?.message || "Failed to verify email");
      }
    };

    verify();
  }, [queryClient]);

  const emailVerified = currentUser?.emailVerified ?? false;
  const phoneVerified = currentUser?.phoneVerified ?? false;
  const insuranceVerified = currentUser?.insuranceVerified ?? Boolean(insuranceDoc);

  const sendPhoneCodeMutation = useMutation({
    mutationFn: async (phone: string) => {
      if (!phone) {
        throw new Error("Phone number is required");
      }
      await authService.sendPhoneCode(phone);
    },
    onSuccess: () => {
      setCodeSent(true);
      toast.success("Verification code sent via SMS");
    },
    onError: (error: Error) => {
      toast.error(error?.message || "Failed to send verification code");
    },
  });

  const verifyPhoneMutation = useMutation({
    mutationFn: async (code: string) => {
      if (code.length !== 6) {
        throw new Error("Invalid verification code");
      }

      if (!phoneNumber) {
        throw new Error("Phone number is required");
      }

      await authService.verifyPhone(phoneNumber, code);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      void queryClient.refetchQueries({ queryKey: ['currentUser'] });
      try {
        localStorage.setItem('spannerwork:authUpdated', String(Date.now()));
      } catch {
        // ignore
      }
      window.dispatchEvent(new CustomEvent('auth:updated'));
      toast.success("Phone verified!");
    },
    onError: (error: Error) => {
      toast.error(error?.message || "Failed to verify phone");
    },
  });

  const verifyEmailMutation = useMutation({
    mutationFn: async () => {
      await authService.sendVerificationEmail();
    },
    onSuccess: () => {
      toast.success("Verification email sent! Please check your inbox.");
    },
  });

  const uploadInsuranceMutation = useMutation({
    mutationFn: async (fileUrl: string) => {
      return fileUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      void queryClient.refetchQueries({ queryKey: ['currentUser'] });
      try {
        localStorage.setItem('spannerwork:authUpdated', String(Date.now()));
      } catch {
        // ignore
      }
      window.dispatchEvent(new CustomEvent('auth:updated'));
      toast.success("Insurance document uploaded!");
    },
  });

  const handleInsuranceUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(true);
    try {
      const result = await uploadService.uploadFile(file);
      const fileUrl = result.data.fileUrl;
      setInsuranceDoc(fileUrl);
      uploadInsuranceMutation.mutate(fileUrl);
    } catch (error) {
      console.error("Error uploading document:", error);
      toast.error("Failed to upload document");
    }
    setUploadingDoc(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-800" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("Profile"))}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Profile
        </Button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Verification Center</h1>
          <p className="text-gray-600">Build trust and unlock features by verifying your account</p>
        </div>

        {/* Email Verification */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600" />
                Email Verification
              </CardTitle>
              {emailVerified && (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {emailVerified ? (
              <div className="text-center py-4">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <p className="text-gray-600">Your email is verified</p>
                <p className="text-sm text-gray-500 mt-1">{currentUser?.email}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-600">
                  Verify your email to receive important notifications and build trust with other users.
                </p>
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertDescription className="text-sm text-blue-800">
                    ✓ Get notified of new messages<br />
                    ✓ Transaction updates<br />
                    ✓ Earn 25 reputation points
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={() => verifyEmailMutation.mutate()}
                  disabled={verifyEmailMutation.isPending}
                  className="w-full"
                >
                  {verifyEmailMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Verification Email
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Phone Verification */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-orange-600" />
                Phone Verification
              </CardTitle>
              {phoneVerified && (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {phoneVerified ? (
              <div className="text-center py-4">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <p className="text-gray-600">Your phone is verified</p>
                <p className="text-sm text-gray-500 mt-1">{currentUser?.phone}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-600">
                  Add an extra layer of security and trust to your account.
                </p>
                <Alert className="bg-orange-50 border-orange-200">
                  <AlertDescription className="text-sm text-orange-800">
                    ✓ Priority in search results<br />
                    ✓ Access to premium tools<br />
                    ✓ Earn 50 reputation points
                  </AlertDescription>
                </Alert>

                <Alert className="bg-blue-50 border-l-4 border-blue-500">
                  <Phone className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-sm text-blue-900">
                    The verification code will be sent to your phone via SMS.
                  </AlertDescription>
                </Alert>

                {!codeSent ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+44 7XXX XXXXXX"
                        value={phoneNumber}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setPhoneNumber(e.target.value)}
                        className="mt-2"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter your phone number (code will be sent via SMS)
                      </p>
                    </div>
                    <Button
                      onClick={() => sendPhoneCodeMutation.mutate(phoneNumber)}
                      disabled={!phoneNumber || sendPhoneCodeMutation.isPending}
                      className="w-full"
                    >
                      {sendPhoneCodeMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending code via SMS...
                        </>
                      ) : (
                        <>
                          <Phone className="w-4 h-4 mr-2" />
                          Send Code via SMS
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-sm text-green-800">
                        ✅ Verification code sent via SMS to your phone.
                        <br />
                        Check your phone for the 6-digit code.
                      </AlertDescription>
                    </Alert>

                    <div>
                      <Label htmlFor="code">Verification Code</Label>
                      <Input
                        id="code"
                        placeholder="Enter 6-digit code from SMS"
                        value={verificationCode}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setVerificationCode(e.target.value)}
                        maxLength={6}
                        className="mt-2 text-center text-2xl font-bold tracking-widest"
                      />
                      <p className="text-xs text-gray-500 mt-1 text-center">
                        Verifying phone: {phoneNumber}
                      </p>
                    </div>
                    <Button
                      onClick={() => verifyPhoneMutation.mutate(verificationCode)}
                      disabled={verificationCode.length !== 6 || verifyPhoneMutation.isPending}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      {verifyPhoneMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Verify Phone
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCodeSent(false);
                        setVerificationCode("");
                      }}
                      className="w-full"
                    >
                      Use Different Number
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Insurance Verification */}
        <Card className="border-none shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600" />
                Insurance Verification
              </CardTitle>
              {insuranceVerified && (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {currentUser?.insuranceVerified ? (
              <div className="text-center py-4">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <p className="text-gray-600">Your insurance is verified</p>
                <p className="text-sm text-gray-500 mt-1">Premium provider badge active</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-600">
                  Required for high-value tools (£1000+). Upload proof of insurance coverage.
                </p>
                <Alert className="bg-purple-50 border-purple-200">
                  <AlertDescription className="text-sm text-purple-800">
                    ✓ List expensive equipment<br />
                    ✓ Premium provider badge<br />
                    ✓ Earn 100 reputation points<br />
                    ✓ Enhanced search visibility
                  </AlertDescription>
                </Alert>

                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleInsuranceUpload}
                  className="hidden"
                  id="insurance-upload"
                />

                <Button
                  onClick={() => document.getElementById('insurance-upload')?.click()}
                  disabled={uploadingDoc || uploadInsuranceMutation.isPending}
                  className="w-full"
                  variant="outline"
                >
                  {uploadingDoc || uploadInsuranceMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Insurance Document
                    </>
                  )}
                </Button>

                <p className="text-xs text-gray-500 text-center">
                  Accepted: PDF, JPG, PNG • Max 10MB
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
