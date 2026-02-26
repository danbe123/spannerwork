import { useState, useEffect, ChangeEvent } from "react";
import { authService, uploadService } from "@/api/services";
import { insuranceService } from "@/api/services/insurance";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Shield,
  Phone,
  Mail,
  CheckCircle,
  Loader2,
  Upload,
  Send,
  FileCheck,
  ShieldCheck,
  AlertCircle,
  Camera,
  Info,
  ExternalLink
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User } from "@/types";
import MarketingFooter from "@/components/MarketingFooter";
import DocsMobileHeader from "@/components/docs/DocsMobileHeader";
import { queryKeys } from "@/lib/queryKeys";

export default function Verification() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [insuranceDoc, setInsuranceDoc] = useState<string | null>(null);
  const [idDoc, setIdDoc] = useState<string | null>(null);
  const [uploadingInsurance, setUploadingInsurance] = useState(false);
  const [uploadingId, setUploadingId] = useState(false);

  const { data: currentUserData, isLoading } = useQuery({
    queryKey: queryKeys.currentUser(),
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
        queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
        void queryClient.refetchQueries({ queryKey: queryKeys.currentUser() });
        try {
          localStorage.setItem('spannerwork:authUpdated', String(Date.now()));
        } catch {
          // localStorage may be unavailable in private browsing mode
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
  const idVerified = currentUser?.idVerified ?? false;
  const insuranceVerified = currentUser?.insuranceVerified ?? Boolean(insuranceDoc);

  // Calculate progress
  const verificationItems = [emailVerified, phoneVerified, idVerified, insuranceVerified];
  const verifiedCount = verificationItems.filter(Boolean).length;
  const progressPercentage = Math.round((verifiedCount / 4) * 100);

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
      queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
      void queryClient.refetchQueries({ queryKey: queryKeys.currentUser() });
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
      await insuranceService.uploadDocument({
        documentUrl: fileUrl,
      });
      return fileUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
      void queryClient.refetchQueries({ queryKey: queryKeys.currentUser() });
      try {
        localStorage.setItem('spannerwork:authUpdated', String(Date.now()));
      } catch {
        // ignore
      }
      window.dispatchEvent(new CustomEvent('auth:updated'));
      toast.success("Insurance document uploaded! It will be reviewed by our team.");
    },
  });

  const uploadIdMutation = useMutation({
    mutationFn: async (fileUrl: string) => {
      // Upload ID as 'OTHER' type document - will be reviewed by admin
      await insuranceService.uploadDocument({
        documentUrl: fileUrl,
        documentType: 'OTHER',
        provider: 'ID_VERIFICATION', // Marker to identify this as ID doc
      });
      return fileUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
      void queryClient.refetchQueries({ queryKey: queryKeys.currentUser() });
      try {
        localStorage.setItem('spannerwork:authUpdated', String(Date.now()));
      } catch {
        // ignore
      }
      window.dispatchEvent(new CustomEvent('auth:updated'));
      toast.success("ID document uploaded! It will be reviewed by our team.");
    },
  });

  const handleInsuranceUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingInsurance(true);
    try {
      const result = await uploadService.uploadFile(file);
      const fileUrl = result.data.fileUrl;
      setInsuranceDoc(fileUrl);
      uploadInsuranceMutation.mutate(fileUrl);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error uploading document:", error);
      }
      toast.error("Failed to upload document");
    }
    setUploadingInsurance(false);
  };

  const handleIdUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingId(true);
    try {
      const result = await uploadService.uploadFile(file);
      const fileUrl = result.data.fileUrl;
      setIdDoc(fileUrl);
      uploadIdMutation.mutate(fileUrl);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error uploading document:", error);
      }
      toast.error("Failed to upload document");
    }
    setUploadingId(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-800" />
      </div>
    );
  }

  return (
    <>
      <DocsMobileHeader />
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100">
        {/* Hero Header */}
        <div className="bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900 text-white">
          <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
            <Button
              variant="ghost"
              onClick={() => navigate(createPageUrl("Profile"))}
              className="mb-6 text-white/80 hover:text-white hover:bg-white/10 -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Profile
            </Button>

            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Shield className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl md:text-3xl font-bold mb-2">Verification Center</h1>
                <p className="text-white/80">
                  Verified providers earn more trust, get higher search rankings, and access premium features
                </p>
              </div>
            </div>

            {/* Progress Section */}
            <div className="mt-8 bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Verification Progress</span>
                <Badge className="bg-white/20 text-white border-0">
                  {verifiedCount}/4 Complete
                </Badge>
              </div>
              <Progress value={progressPercentage} className="h-3 bg-white/20" />
              <div className="flex justify-between mt-3 text-xs text-white/60">
                <span>Email</span>
                <span>Mobile</span>
                <span>ID</span>
                <span>Insurance</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="grid gap-6">
            {/* Email Verification */}
            <Card className="border-none shadow-lg overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100/50 border-b border-blue-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Email Verification</CardTitle>
                      <p className="text-sm text-gray-500">Confirm your email address</p>
                    </div>
                  </div>
                  {emailVerified && (
                    <Badge className="bg-green-100 text-green-800 border-0">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {emailVerified ? (
                  <div className="text-center py-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <p className="font-medium text-gray-900">Your email is verified</p>
                    <p className="text-sm text-gray-500 mt-1">{currentUser?.email}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Alert className="bg-blue-50 border-blue-200">
                      <Info className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-sm text-blue-800">
                        <strong>Benefits of email verification:</strong>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>Receive important booking notifications</li>
                          <li>Get message alerts from customers</li>
                          <li>Earn 25 reputation points</li>
                        </ul>
                      </AlertDescription>
                    </Alert>
                    <Button
                      onClick={() => verifyEmailMutation.mutate()}
                      disabled={verifyEmailMutation.isPending}
                      className="w-full bg-blue-600 hover:bg-blue-700"
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
            <Card className="border-none shadow-lg overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-brand-50 to-brand-100/50 border-b border-brand-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center">
                      <Phone className="w-5 h-5 text-brand-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Mobile Verification</CardTitle>
                      <p className="text-sm text-gray-500">Verify via SMS</p>
                    </div>
                  </div>
                  {phoneVerified && (
                    <Badge className="bg-green-100 text-green-800 border-0">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {phoneVerified ? (
                  <div className="text-center py-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <p className="font-medium text-gray-900">Your mobile is verified</p>
                    <p className="text-sm text-gray-500 mt-1">{currentUser?.phone}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Alert className="bg-brand-50 border-brand-200">
                      <Info className="h-4 w-4 text-brand-600" />
                      <AlertDescription className="text-sm text-brand-800">
                        <strong>Benefits of mobile verification:</strong>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>Priority in search results</li>
                          <li>SMS notifications for urgent bookings</li>
                          <li>Earn 50 reputation points</li>
                        </ul>
                      </AlertDescription>
                    </Alert>

                    {!codeSent ? (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="phone">Mobile Number</Label>
                          <Input
                            id="phone"
                            type="tel"
                            placeholder="+44 7XXX XXXXXX"
                            value={phoneNumber}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setPhoneNumber(e.target.value)}
                            className="mt-2"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Include country code (e.g., +44 for UK)
                          </p>
                        </div>
                        <Button
                          onClick={() => sendPhoneCodeMutation.mutate(phoneNumber)}
                          disabled={!phoneNumber || sendPhoneCodeMutation.isPending}
                          className="w-full bg-brand-600 hover:bg-brand-700"
                        >
                          {sendPhoneCodeMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Phone className="w-4 h-4 mr-2" />
                              Send Verification Code
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Alert className="bg-green-50 border-green-200">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <AlertDescription className="text-sm text-green-800">
                            Code sent to {phoneNumber}. Check your messages.
                          </AlertDescription>
                        </Alert>

                        <div>
                          <Label htmlFor="code">Enter 6-Digit Code</Label>
                          <Input
                            id="code"
                            placeholder="• • • • • •"
                            value={verificationCode}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setVerificationCode(e.target.value)}
                            maxLength={6}
                            className="mt-2 text-center text-2xl font-bold tracking-[0.5em]"
                          />
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
                              Verify Code
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
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

            {/* ID Verification */}
            <Card className="border-none shadow-lg overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100/50 border-b border-purple-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <FileCheck className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">ID Verification</CardTitle>
                      <p className="text-sm text-gray-500">Upload government-issued ID</p>
                    </div>
                  </div>
                  {idVerified ? (
                    <Badge className="bg-green-100 text-green-800 border-0">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Verified
                    </Badge>
                  ) : idDoc ? (
                    <Badge className="bg-yellow-100 text-yellow-800 border-0">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Under Review
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {idVerified ? (
                  <div className="text-center py-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <p className="font-medium text-gray-900">Your ID is verified</p>
                    <p className="text-sm text-gray-500 mt-1">Identity confirmed</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Alert className="bg-purple-50 border-purple-200">
                      <Info className="h-4 w-4 text-purple-600" />
                      <AlertDescription className="text-sm text-purple-800">
                        <strong>Why verify your ID?</strong>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>Become a trusted provider</li>
                          <li>Access to high-value tool rentals</li>
                          <li>Earn 75 reputation points</li>
                          <li>Build trust with customers</li>
                        </ul>
                      </AlertDescription>
                    </Alert>

                    <div className="border-2 border-dashed border-purple-200 rounded-xl p-6 text-center hover:border-purple-400 transition-colors">
                      <Camera className="w-10 h-10 text-purple-400 mx-auto mb-3" />
                      <p className="font-medium text-gray-900 mb-1">Upload ID Document</p>
                      <p className="text-sm text-gray-500 mb-4">
                        Valid passport, driving licence, or national ID card (both sides if applicable)
                      </p>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleIdUpload}
                        className="hidden"
                        id="id-upload"
                      />
                      <Button
                        onClick={() => document.getElementById('id-upload')?.click()}
                        disabled={uploadingId || uploadIdMutation.isPending}
                        variant="outline"
                        className="border-purple-300 text-purple-700 hover:bg-purple-50"
                      >
                        {uploadingId || uploadIdMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Choose File
                          </>
                        )}
                      </Button>
                    </div>

                    <Alert className="bg-gray-50 border-gray-200">
                      <AlertCircle className="h-4 w-4 text-gray-600" />
                      <AlertDescription className="text-xs text-gray-600">
                        Your ID is encrypted and securely reviewed by our verification team within 24-48 hours.
                        Accepted formats: PDF, JPG, PNG (up to 10MB).
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Insurance Verification */}
            <Card className="border-none shadow-lg overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-100/50 border-b border-green-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Insurance Verification</CardTitle>
                      <p className="text-sm text-gray-500">Upload proof of insurance</p>
                    </div>
                  </div>
                  {currentUser?.insuranceVerified ? (
                    <Badge className="bg-green-100 text-green-800 border-0">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Verified
                    </Badge>
                  ) : insuranceDoc ? (
                    <Badge className="bg-yellow-100 text-yellow-800 border-0">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Under Review
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {currentUser?.insuranceVerified ? (
                  <div className="text-center py-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <p className="font-medium text-gray-900">Your insurance is verified</p>
                    <p className="text-sm text-gray-500 mt-1">Premium provider badge active</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Alert className="bg-green-50 border-green-200">
                      <Info className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-sm text-green-800">
                        <strong>Insurance verification benefits:</strong>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>List high-value tools (£1000+)</li>
                          <li>Premium provider badge</li>
                          <li>Earn 100 reputation points</li>
                          <li>Enhanced search visibility</li>
                        </ul>
                      </AlertDescription>
                    </Alert>

                    <div className="border-2 border-dashed border-green-200 rounded-xl p-6 text-center hover:border-green-400 transition-colors">
                      <ShieldCheck className="w-10 h-10 text-green-400 mx-auto mb-3" />
                      <p className="font-medium text-gray-900 mb-1">Upload Insurance Document</p>
                      <p className="text-sm text-gray-500 mb-4">
                        Public liability, professional indemnity, or trade-specific insurance certificate
                      </p>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleInsuranceUpload}
                        className="hidden"
                        id="insurance-upload"
                      />
                      <Button
                        onClick={() => document.getElementById('insurance-upload')?.click()}
                        disabled={uploadingInsurance || uploadInsuranceMutation.isPending}
                        variant="outline"
                        className="border-green-300 text-green-700 hover:bg-green-50"
                      >
                        {uploadingInsurance || uploadInsuranceMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Choose File
                          </>
                        )}
                      </Button>
                    </div>

                    <Alert className="bg-gray-50 border-gray-200">
                      <AlertCircle className="h-4 w-4 text-gray-600" />
                      <AlertDescription className="text-xs text-gray-600">
                        Your insurance certificate is securely reviewed within 24-48 hours. Once verified, you'll receive the premium provider badge.
                        Accepted formats: PDF, JPG, PNG (up to 10MB).
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Help Section */}
            <Card className="border-none shadow-md bg-gray-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <Info className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Need help?</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Having trouble with verification or have questions about the process? Our support team is ready to help.
                    </p>
                    <Button variant="outline" size="sm" asChild>
                      <a href="/support" className="inline-flex items-center">
                        Contact Support
                        <ExternalLink className="w-3 h-3 ml-2" />
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <MarketingFooter />
    </>
  );
}
