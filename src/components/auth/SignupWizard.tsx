/**
 * SignupWizard Component
 *
 * Multi-step registration wizard for new users.
 * Steps: Password → Profile → Location
 */

import { FormEvent, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Lock,
  User,
  MapPin,
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Shield,
  Users,
  Star,
} from "lucide-react";

type WizardStep = "password" | "profile" | "location";

interface SignupWizardProps {
  email: string;
  onComplete: (data: SignupData) => void;
  onBack: () => void;
  isPending: boolean;
  error: string;
}

export interface SignupData {
  email: string;
  password: string;
  name: string;
  postcode?: string;
}

const STEPS: WizardStep[] = ["password", "profile", "location"];

const STEP_INFO = {
  password: { title: "Create password", icon: Lock },
  profile: { title: "Your details", icon: User },
  location: { title: "Your location", icon: MapPin },
};

// Password validation
interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "One number", test: (p) => /\d/.test(p) },
  { label: "One special character", test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

function TrustSignals() {
  return (
    <div className="space-y-3 mt-6 pt-6 border-t border-gray-100">
      <div className="flex items-center gap-3 text-sm text-gray-600">
        <div className="p-1.5 rounded-lg bg-green-100">
          <Shield className="w-4 h-4 text-green-600" />
        </div>
        <span>Verified mechanics only</span>
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-600">
        <div className="p-1.5 rounded-lg bg-blue-100">
          <Users className="w-4 h-4 text-blue-600" />
        </div>
        <span>Join 5,000+ mechanics</span>
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-600">
        <div className="p-1.5 rounded-lg bg-yellow-100">
          <Star className="w-4 h-4 text-yellow-600" />
        </div>
        <span>4.8 average rating</span>
      </div>
    </div>
  );
}

export function SignupWizard({ email, onComplete, onBack, isPending, error }: SignupWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>("password");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [postcode, setPostcode] = useState("");
  const [stepError, setStepError] = useState("");

  const currentStepIndex = STEPS.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const passwordValid = useMemo(() => {
    return PASSWORD_REQUIREMENTS.every((req) => req.test(password));
  }, [password]);

  const passwordsMatch = password === confirmPassword;

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case "password":
        return passwordValid && passwordsMatch && confirmPassword.length > 0;
      case "profile":
        return name.trim().length >= 2;
      case "location":
        return true; // Location is optional
      default:
        return false;
    }
  }, [currentStep, passwordValid, passwordsMatch, confirmPassword, name]);

  const handleNext = () => {
    setStepError("");
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]);
    } else {
      // Complete registration
      onComplete({
        email,
        password,
        name: name.trim(),
        postcode: postcode.trim() || undefined,
      });
    }
  };

  const handlePrevious = () => {
    setStepError("");
    if (currentStepIndex > 0) {
      setCurrentStep(STEPS[currentStepIndex - 1]);
    } else {
      onBack();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (canProceed) {
      handleNext();
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "password":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  autoFocus
                  placeholder="Create a strong password"
                  className="pl-10 pr-10 h-12"
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

            {/* Password Requirements */}
            <div className="space-y-2">
              {PASSWORD_REQUIREMENTS.map((req, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 text-sm transition-colors ${
                    req.test(password) ? "text-green-600" : "text-gray-400"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center ${
                      req.test(password)
                        ? "bg-green-100"
                        : "bg-gray-100"
                    }`}
                  >
                    {req.test(password) && <Check className="w-3 h-3" />}
                  </div>
                  {req.label}
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  placeholder="Confirm your password"
                  className="pl-10 h-12"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="text-sm text-red-600">Passwords don't match</p>
              )}
            </div>
          </div>
        );

      case "profile":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="name"
                  type="text"
                  required
                  autoComplete="name"
                  autoFocus
                  placeholder="Your full name"
                  className="pl-10 h-12"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-500">
                This will be visible to other users
              </p>
            </div>

            <TrustSignals />
          </div>
        );

      case "location":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="postcode">Postcode (optional)</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="postcode"
                  type="text"
                  autoComplete="postal-code"
                  autoFocus
                  placeholder="e.g. SW1A 1AA"
                  className="pl-10 h-12 uppercase"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                />
              </div>
              <p className="text-xs text-gray-500">
                Helps us show you tools and workshops nearby. You can add this later.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-brand-50 border border-brand-100">
              <p className="text-sm text-brand-900">
                <strong>Almost there!</strong> After signing up, you'll verify your email to unlock
                all features including messaging and bookings.
              </p>
            </div>
          </div>
        );
    }
  };

  const CurrentIcon = STEP_INFO[currentStep].icon;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Step {currentStepIndex + 1} of {STEPS.length}
          </span>
          <span className="font-medium text-gray-900">
            {STEP_INFO[currentStep].title}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Email Display */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
        <div className="p-2 rounded-lg bg-brand-100">
          <CurrentIcon className="w-4 h-4 text-brand-800" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500">Creating account for</p>
          <p className="font-medium text-gray-900 truncate">{email}</p>
        </div>
      </div>

      {/* Step Content */}
      <form onSubmit={handleSubmit}>
        {renderStepContent()}

        {/* Errors */}
        {(stepError || error) && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 mt-4">
            <p className="text-sm text-red-700 font-medium">{stepError || error}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-11"
            onClick={handlePrevious}
            disabled={isPending}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <Button
            type="submit"
            className="flex-1 h-11 bg-brand-800 hover:bg-brand-900"
            disabled={!canProceed || isPending}
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </span>
            ) : currentStepIndex === STEPS.length - 1 ? (
              <span className="flex items-center gap-2">
                Create account
                <Check className="w-4 h-4" />
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Continue
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
