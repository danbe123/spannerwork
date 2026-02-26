/**
 * Create - Unified Listing & Request Wizard
 *
 * Multi-step creation flow for posting jobs or listing items:
 * - Step 0: Intent selection (need something vs offer something)
 * - Step 1: Category selection (tools, space, expertise)
 * - Step 2: Details form with AI-assisted content generation
 *
 * Features:
 * - AI-powered listing generation from photos and descriptions
 * - Real-time form validation with inline feedback
 * - Mobile-optimised thumb-friendly interface
 * - Animated transitions between steps
 */

import { useState, useEffect, useCallback, ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  authService, 
  requestsService, 
  toolsService, 
  spacesService, 
  servicesService, 
  uploadService,
  usersService 
} from "@/api/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnimatedInput } from "@/components/ui/animated-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Wrench,
  ArrowLeft,
  ArrowRight,
  Loader2,
  X,
  MapPin,
  Check,
  Globe,
  Target,
  ImagePlus,
  Rocket,
  FileText,
  PoundSterling,
  Shield,
} from "lucide-react";
import SEO from "@/components/SEO";
import { toast } from "sonner";
import type { Category, Urgency, RateType, ToolCondition } from "@/types";
import { queryKeys } from "@/lib/queryKeys";

// Import shared components and constants
import {
  NeedData,
  OfferData,
  FormErrors,
  INITIAL_NEED_DATA,
  INITIAL_OFFER_DATA,
  INTENTS,
  CATEGORIES,
  URGENCY_OPTIONS,
  TOOL_CATEGORIES,
  TOOL_CONDITIONS,
  SPACE_FEATURES,
  SERVICE_SPECIALTIES,
  containerVariants,
  itemVariants,
  SuccessCelebration,
  ProgressStep,
  StepIndicator,
  AIListingAssistant,
  AISuggestionPreview,
  AIRequestAssistant,
  AIRequestPreview,
} from "@/components/create";
import type { GeneratedListing, GeneratedRequest } from "@/api/services/ai";
import { aiService } from "@/api/services/ai";

// Main wizard component
export default function Create() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // URL params can pre-select intent (e.g., /create?intent=offer)
  const initialIntent = searchParams.get('intent') || "need";

  // Wizard navigation: step 0=Intent, step 1=Category, step 2=Details+Pricing
  const [step, setStep] = useState(0);
  const [intent, setIntent] = useState(initialIntent);
  const [category, setCategory] = useState("TOOLS");
  const [errors, setErrors] = useState<FormErrors>({});
  const [showSuccess, setShowSuccess] = useState(false);

  // Shared form state across both flows
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [postcode, setPostcode] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Form state
  const [needData, setNeedData] = useState<NeedData>(INITIAL_NEED_DATA);
  const [offerData, setOfferData] = useState<OfferData>(INITIAL_OFFER_DATA);

  // AI suggestion state for offers
  const [aiSuggestions, setAiSuggestions] = useState<GeneratedListing | null>(null);
  const [showAIPreview, setShowAIPreview] = useState(false);

  // AI suggestion state for requests
  const [aiRequestSuggestions, setAiRequestSuggestions] = useState<GeneratedRequest | null>(null);
  const [showAIRequestPreview, setShowAIRequestPreview] = useState(false);
  const [aiRequestPhotos, setAiRequestPhotos] = useState<string[]>([]);

  // AI auto-prefill state - tracks which fields were AI suggested
  const [aiPrefilled, setAiPrefilled] = useState<{
    specialties: boolean;
    features: boolean;
    condition: boolean;
  }>({ specialties: false, features: false, condition: false });
  const [lastPrefillDesc, setLastPrefillDesc] = useState("");
  const [isModeratingContent, setIsModeratingContent] = useState(false);

  // Get current user
  const { data: currentUserData } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: () => authService.getCurrentUser(),
  });
  const currentUser = currentUserData?.user;

  const isProfileCompleteForJob = !!(
    currentUser?.emailVerified &&
    currentUser?.name &&
    (currentUser?.locationAddress || currentUser?.postcode)
  );

  // Pre-fill postcode from user profile (check both postcode and locationAddress)
  useEffect(() => {
    if (!postcode) {
      const userPostcode = currentUser?.postcode || currentUser?.locationAddress;
      if (userPostcode) {
        setPostcode(userPostcode);
      }
    }
  }, [currentUser, postcode]);

  // ============================================
  // RESET FUNCTION - for "Create Another"
  // ============================================
  const resetForm = useCallback(() => {
    setStep(0);
    setIntent(initialIntent);
    setCategory("TOOLS");
    setErrors({});
    setPhotos([]);
    setPhotoPreviews([]);
    setNeedData(INITIAL_NEED_DATA);
    setOfferData(INITIAL_OFFER_DATA);
    setShowSuccess(false);
    setAiSuggestions(null);
    setShowAIPreview(false);
    setAiPhotos([]);
    setAiRequestSuggestions(null);
    setShowAIRequestPreview(false);
    setAiRequestPhotos([]);
    setAiPrefilled({ specialties: false, features: false, condition: false });
    setLastPrefillDesc("");
  }, [initialIntent]);

  // ============================================
  // KEYBOARD-AWARE INPUT FOCUS
  // ============================================
  const handleInputFocus = useCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Wait for keyboard animation to complete, then scroll input into view
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }, []);

  // ============================================
  // PHOTO HANDLING
  // ============================================
  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const availableSlots = 5 - photos.length;
    if (availableSlots <= 0) {
      setErrors(prev => ({ ...prev, photos: "Maximum 5 photos allowed" }));
      return;
    }
    
    if (files.length > availableSlots) {
      setErrors(prev => ({ ...prev, photos: `Only ${availableSlots} more photo${availableSlots === 1 ? '' : 's'} can be added` }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.photos;
        return newErrors;
      });
    }
    
    const filesToUpload = files.slice(0, availableSlots);

    setIsUploading(true);
    try {
      for (const file of filesToUpload) {
        const preview = URL.createObjectURL(file);
        setPhotoPreviews(prev => [...prev, preview].slice(0, 5));
        
        const result = await uploadService.uploadFile(file);
        setPhotos(prev => [...prev, result.data.fileUrl].slice(0, 5));
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Upload failed:", error);
      }
      setErrors(prev => ({ ...prev, photos: "Upload failed. Please try again." }));
    }
    setIsUploading(false);
  };

  const removePhoto = (index: number) => {
    if (photoPreviews[index]) URL.revokeObjectURL(photoPreviews[index]);
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // ============================================
  // AI SUGGESTION HANDLING
  // ============================================
  const [aiPhotos, setAiPhotos] = useState<string[]>([]);

  const handleAISuggestionsGenerated = (suggestions: GeneratedListing, uploadedPhotos: string[]) => {
    setAiSuggestions(suggestions);
    setAiPhotos(uploadedPhotos);
    setShowAIPreview(true);
  };

  const handleAcceptAISuggestions = (accepted: Partial<GeneratedListing>) => {
    setOfferData(prev => ({
      ...prev,
      name: accepted.title || prev.name,
      title: accepted.title || prev.title,
      description: accepted.description || prev.description,
      toolCategory: accepted.category || prev.toolCategory,
      dailyRate: accepted.suggestedDailyRate ? (accepted.suggestedDailyRate / 100).toString() : prev.dailyRate,
      deposit: accepted.suggestedDeposit ? (accepted.suggestedDeposit / 100).toString() : prev.deposit,
      condition: accepted.condition || prev.condition,
    }));

    // Apply photos from AI section to the main listing
    if (aiPhotos.length > 0) {
      setPhotos(aiPhotos);
      setPhotoPreviews(aiPhotos); // Use URLs as previews since they're already uploaded
    }

    setShowAIPreview(false);
    toast.success("AI suggestions applied to your listing!");
  };

  // AI Request suggestion handlers
  const handleAIRequestGenerated = (suggestions: GeneratedRequest, uploadedPhotos: string[]) => {
    setAiRequestSuggestions(suggestions);
    setAiRequestPhotos(uploadedPhotos);
    setShowAIRequestPreview(true);
  };

  const handleAcceptAIRequest = (accepted: Partial<GeneratedRequest>) => {
    setNeedData(prev => ({
      ...prev,
      title: accepted.title || prev.title,
      description: accepted.description || prev.description,
      budget: accepted.suggestedBudget ? (accepted.suggestedBudget / 100).toString() : prev.budget,
      rateType: accepted.suggestedRateType || prev.rateType,
      urgency: accepted.suggestedUrgency || prev.urgency,
    }));

    // Apply photos from AI section to the main listing
    if (aiRequestPhotos.length > 0) {
      setPhotos(aiRequestPhotos);
      setPhotoPreviews(aiRequestPhotos);
    }

    setShowAIRequestPreview(false);
    toast.success("AI suggestions applied to your request!");
  };

  // ============================================
  // MUTATIONS
  // ============================================
  const createRequestMutation = useMutation({
    mutationFn: async (data: NeedData) => {
      if (currentUser && postcode !== currentUser.postcode) {
        try {
          await usersService.update(currentUser.id, { locationAddress: postcode });
          queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
        } catch (e) { if (import.meta.env.DEV) console.error('Failed to update postcode:', e); }
      }
      return requestsService.create({
        title: data.title,
        description: data.description,
        category: category as Category,
        urgency: data.urgency as Urgency,
        budget: Math.round((parseFloat(data.budget) || 0) * 100),
        rateType: data.rateType as RateType,
        broadcastRadius: data.nationwideSearch ? 999 : data.broadcastRadius,
        postcode,
        photos,
        sponsorCpaPercent: data.sponsorEnabled ? data.sponsorCpaPercent : 0
      });
    },
    onSuccess: () => {
      // Invalidate AND refetch all request-related queries to ensure feed updates immediately
      // Using refetchType: 'all' ensures even inactive queries are refetched when the user navigates
      queryClient.invalidateQueries({ queryKey: ['requests'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: queryKeys.myRequests(), refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed(), refetchType: 'all' });
      setShowSuccess(true);
    },
    onError: (error) => setErrors({ submit: error.message || "Failed to create" })
  });

  const createToolMutation = useMutation({
    mutationFn: (data: OfferData) => toolsService.create({
      name: data.name,
      description: data.description,
      category: data.toolCategory || "Other",
      condition: data.condition as ToolCondition,
      dailyRate: Math.round(parseFloat(data.dailyRate) || 0),
      weeklyRate: data.weeklyRate ? Math.round(parseFloat(data.weeklyRate)) : undefined,
      deposit: Math.round(parseFloat(data.deposit) || 0),
      photos,
      postcode,
      sponsorCpaPercent: data.sponsorEnabled ? data.sponsorCpaPercent : 0
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tools() });
      setShowSuccess(true);
    },
    onError: (error) => setErrors({ submit: error.message || "Failed to create" })
  });

  const createSpaceMutation = useMutation({
    mutationFn: (data: OfferData) => spacesService.create({
      name: data.name,
      description: data.description,
      hourlyRate: data.hourlyRate ? Math.round(parseFloat(data.hourlyRate)) : undefined,
      dailyRate: Math.round(parseFloat(data.dailyRate) || 0),
      features: data.features,
      photos,
      postcode,
      locationAddress: postcode,
      sponsorCpaPercent: data.sponsorEnabled ? data.sponsorCpaPercent : 0
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.spaces() });
      setShowSuccess(true);
    },
    onError: (error) => setErrors({ submit: error.message || "Failed to create" })
  });

  const createServiceMutation = useMutation({
    mutationFn: (data: OfferData) => servicesService.create({
      name: data.title,
      description: data.description,
      hourlyRate: Math.round(parseFloat(data.hourlyRate) || 0),
      calloutFee: data.calloutFee ? Math.round(parseFloat(data.calloutFee)) : undefined,
      radius: data.radius,
      specialties: data.specialties,
      photos,
      postcode,
      sponsorCpaPercent: data.sponsorEnabled ? data.sponsorCpaPercent : 0
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services() });
      setShowSuccess(true);
    },
    onError: (error) => setErrors({ submit: error.message || "Failed to create" })
  });

  const isSubmitting = createRequestMutation.isPending || createToolMutation.isPending || 
                       createSpaceMutation.isPending || createServiceMutation.isPending;

  // ============================================
  // VALIDATION
  // ============================================
  const validateStep = (stepNum: number): boolean => {
    const newErrors: FormErrors = {};

    if (stepNum === 1 && !category) {
      newErrors.category = "Please select a category";
    }

    if (stepNum === 2) {
      // Validate details
      if (intent === "need") {
        if (!needData.title.trim() || needData.title.length < 5) newErrors.title = "Title required (min 5 chars)";
        if (!needData.description.trim() || needData.description.length < 20) newErrors.description = "Description required (min 20 chars)";
        if (!needData.budget || parseFloat(needData.budget) <= 0) newErrors.budget = "Budget required";
      } else {
        const name = category === "service" ? offerData.title : offerData.name;
        if (!name.trim()) newErrors.name = "Name/title required";
        if (!offerData.description.trim() || offerData.description.length < 20) newErrors.description = "Description required (min 20 chars)";

        // Photos required for tool and space, optional for service
        if ((category === "tool" || category === "space") && photos.length === 0) {
          newErrors.photos = "At least 1 photo required";
        }

        // Validate pricing
        if (category === "tool" && (!offerData.dailyRate || parseFloat(offerData.dailyRate) <= 0)) newErrors.rate = "Daily rate required";
        if (category === "space" && (!offerData.dailyRate || parseFloat(offerData.dailyRate) <= 0)) newErrors.rate = "Daily rate required";
        if (category === "service" && (!offerData.hourlyRate || parseFloat(offerData.hourlyRate) <= 0)) newErrors.rate = "Hourly rate required";

        // Service requires at least 1 specialty
        if (category === "service" && offerData.specialties.length === 0) {
          newErrors.name = "Select at least 1 specialty";
        }
      }
      
      // Validate postcode
      if (!postcode.trim() || postcode.length < 5) newErrors.postcode = "Valid postcode required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ============================================
  // NAVIGATION
  // ============================================
  const nextStep = () => {
    if (step === 0) {
      if (!intent) {
        setErrors({ intent: "Please select an option" });
        return;
      }

      if (intent === 'need' && currentUser && !isProfileCompleteForJob) {
        toast.error('Complete your profile before posting a job.');
        navigate('/profile?welcome=1');
        return;
      }

      setStep(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (validateStep(step)) {
      setStep(prev => Math.min(prev + 1, 2));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    if (step === 1 && initialIntent) {
      navigate(-1);
    } else {
      setStep(prev => Math.max(prev - 1, 0));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    if (intent === 'need' && currentUser && !isProfileCompleteForJob) {
      toast.error('Complete your profile before posting a job.');
      navigate('/profile?welcome=1');
      return;
    }
    if (!validateStep(2)) return;

    // Content moderation check for requests
    if (intent === "need") {
      setIsModeratingContent(true);
      try {
        const moderation = await aiService.moderateContent({
          title: needData.title,
          description: needData.description,
          category: category,
          listingType: 'request',
        });

        if (!moderation.approved) {
          const violationMessages = moderation.violations
            .filter(v => v.severity === 'BLOCK')
            .map(v => v.detail)
            .join('. ');
          toast.error(`Request cannot be published: ${violationMessages || 'Policy violation detected'}`);
          setIsModeratingContent(false);
          return;
        }

        if (moderation.warnings && moderation.warnings.length > 0) {
          toast.warning(moderation.warnings[0]);
        }
      } catch (error) {
        // Fail open - if moderation fails, proceed anyway
        if (import.meta.env.DEV) {
          console.error('Moderation check failed:', error);
        }
      }
      setIsModeratingContent(false);
    }

    // Content moderation check for offers
    if (intent === "offer") {
      setIsModeratingContent(true);
      try {
        const title = category === "service" ? offerData.title : offerData.name;
        const moderation = await aiService.moderateContent({
          title,
          description: offerData.description,
          category: offerData.toolCategory || category,
          listingType: category as 'tool' | 'space' | 'service',
        });

        if (!moderation.approved) {
          // Show blocking violations
          const violationMessages = moderation.violations
            .filter(v => v.severity === 'BLOCK')
            .map(v => v.detail)
            .join('. ');
          toast.error(`Listing cannot be published: ${violationMessages || 'Policy violation detected'}`);
          setIsModeratingContent(false);
          return;
        }

        // Show warnings but allow proceed
        if (moderation.warnings && moderation.warnings.length > 0) {
          toast.warning(moderation.warnings[0]);
        }
      } catch (error) {
        // Fail open - if moderation fails, proceed anyway
        if (import.meta.env.DEV) {
          console.error('Moderation check failed:', error);
        }
      }
      setIsModeratingContent(false);
    }

    if (intent === "need") createRequestMutation.mutate(needData);
    else if (category === "tool") createToolMutation.mutate(offerData);
    else if (category === "space") createSpaceMutation.mutate(offerData);
    else if (category === "service") createServiceMutation.mutate(offerData);
  };

  // Helper for toggling array items - clears AI badge on manual change
  type ArrayKeys = 'features' | 'specialties';
  const toggleArrayItem = (key: ArrayKeys, item: string) => {
    setOfferData(prev => {
      const currentList = prev[key];
      return {
        ...prev,
        [key]: currentList.includes(item)
          ? currentList.filter(i => i !== item)
          : [...currentList, item]
      };
    });
    // Clear AI badge when user manually changes
    setAiPrefilled(prev => ({ ...prev, [key]: false }));
  };

  // Auto-prefill specialties/features/condition from description
  const handleDescriptionBlur = async () => {
    if (intent !== "offer") return;
    const desc = offerData.description;

    // Only trigger if description has 20+ chars and changed since last prefill
    if (desc.length < 20 || desc === lastPrefillDesc) return;
    setLastPrefillDesc(desc);

    try {
      const suggestions = await aiService.suggestCategories(desc, category as 'tool' | 'space' | 'service');

      // Auto-fill specialties for services
      if (category === "service" && suggestions.suggestedSpecialties && suggestions.suggestedSpecialties.length > 0) {
        setOfferData(prev => ({
          ...prev,
          specialties: suggestions.suggestedSpecialties || prev.specialties
        }));
        setAiPrefilled(prev => ({ ...prev, specialties: true }));
      }

      // Auto-fill features for spaces
      if (category === "space" && suggestions.suggestedFeatures && suggestions.suggestedFeatures.length > 0) {
        setOfferData(prev => ({
          ...prev,
          features: suggestions.suggestedFeatures || prev.features
        }));
        setAiPrefilled(prev => ({ ...prev, features: true }));
      }

      // Auto-fill condition for tools
      if (category === "tool" && suggestions.suggestedCondition) {
        setOfferData(prev => ({
          ...prev,
          condition: suggestions.suggestedCondition || prev.condition
        }));
        setAiPrefilled(prev => ({ ...prev, condition: true }));
      }
    } catch (error) {
      // Silently fail - don't interrupt user flow
      if (import.meta.env.DEV) {
        console.error('AI prefill error:', error);
      }
    }
  };

  const selectedCategory = intent === "need" 
    ? CATEGORIES.need.find(c => c.value === category)
    : CATEGORIES.offer.find(c => c.value === category);

  const hasVerifiedEmail = !!currentUser?.emailVerified;

  // ============================================
  // RENDER - Verification Required
  // ============================================
  if (currentUser && !hasVerifiedEmail) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <SEO title="Verification Required - SpannerWork" description="Verify your account to post" />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8 text-brand-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Verification Required</h1>
            <p className="text-gray-600 mb-6">
              To protect our community, please verify your email address before posting jobs or listings.
            </p>
            <div className="space-y-3">
              <Button
                onClick={() => navigate('/verification')}
                className="w-full bg-brand hover:bg-brand-900"
              >
                <Shield className="w-4 h-4 mr-2" />
                Verify Email
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate(-1)}
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ============================================
  // RENDER - Main Wizard
  // ============================================
  return (
    <div className="bg-gray-50 pb-16 md:pb-0 md:min-h-dvh">
      <SEO title="Create - SpannerWork" description="Post a job or list your offering" />

      {/* Success Celebration Modal */}
      <SuccessCelebration
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
        onReset={resetForm}
        intent={intent}
      />

      {/* AI Suggestion Preview Modal - Offers */}
      <AISuggestionPreview
        isOpen={showAIPreview}
        onClose={() => setShowAIPreview(false)}
        suggestions={aiSuggestions}
        listingType={category as 'tool' | 'space' | 'service'}
        onAccept={handleAcceptAISuggestions}
      />

      {/* AI Request Preview Modal - Requests */}
      <AIRequestPreview
        isOpen={showAIRequestPreview}
        onClose={() => setShowAIRequestPreview(false)}
        suggestions={aiRequestSuggestions}
        category={category as 'TOOLS' | 'EXPERTISE' | 'SPACE'}
        onAccept={handleAcceptAIRequest}
      />

      {/* Header with Progress */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => step > 0 ? prevStep() : navigate(-1)}
              className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {step > 0 ? 'Back' : 'Cancel'}
            </Button>
            
            {step > 0 && (
              <StepIndicator currentStep={step} totalSteps={2} />
            )}
          </div>
          
          {/* Progress bar - 2 steps */}
          {step > 0 && (
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <ProgressStep step={1} currentStep={step} icon={Wrench} label="Category" />
                <div className="flex-1 mt-5 mx-2">
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-brand to-brand-500 rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: step >= 2 ? '100%' : '0%' }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                </div>
                <ProgressStep step={2} currentStep={step} icon={FileText} label="Details" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-4 md:py-8">
        <AnimatePresence mode="wait">
          
          {/* ============================================ */}
          {/* STEP 0: INTENT SELECTION */}
          {/* ============================================ */}
          {step === 0 && (
            <motion.div
              key="step0"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, scale: 0.95 }}
              className="md:min-h-[70vh] md:flex md:flex-col"
            >
              <motion.div variants={itemVariants} className="text-center mb-4 md:mb-10">
                <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-1 md:mb-3">
                  What would you like to do?
                </h1>
                <p className="text-gray-500 text-sm md:text-base">
                  Choose an option to get started
                </p>
              </motion.div>

              <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-5">
                {INTENTS.map((option) => {
                  const Icon = option.icon;
                  const isSelected = intent === option.id;

                  return (
                    <motion.button
                      key={option.id}
                      whileHover={{ y: -4, boxShadow: "0 12px 40px rgba(0,0,0,0.12)" }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setIntent(option.id)}
                      className={`
                        relative text-left rounded-xl md:rounded-2xl bg-white border-2 transition-all duration-200 overflow-hidden
                        ${isSelected
                          ? 'border-brand shadow-lg shadow-brand-500/10'
                          : 'border-gray-200 hover:border-gray-300 shadow-sm'
                        }
                      `}
                    >
                      <div className={`h-1 md:h-1.5 transition-all ${isSelected ? 'bg-gradient-to-r from-brand to-brand-500' : 'bg-gradient-to-r from-brand-200 to-brand-100'}`} />

                      <div className="p-3 md:p-6">
                        <div className="flex items-center md:items-start gap-3 md:gap-0 md:flex-col">
                          <div className="flex items-center gap-3 md:justify-between md:w-full md:mb-5">
                            <div className={`
                              w-10 h-10 md:w-14 md:h-14 rounded-lg md:rounded-xl flex items-center justify-center transition-all duration-200 shrink-0
                              ${isSelected
                                ? 'bg-gradient-to-br from-brand to-brand-500 shadow-lg shadow-brand-500/30'
                                : 'bg-brand-50 border-2 border-brand-100'
                              }
                            `}>
                              <Icon className={`w-5 h-5 md:w-7 md:h-7 ${isSelected ? 'text-white' : 'text-brand'}`} />
                            </div>

                            <AnimatePresence>
                              {isSelected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  exit={{ scale: 0 }}
                                  className="hidden md:flex w-8 h-8 bg-brand rounded-full items-center justify-center"
                                >
                                  <Check className="w-5 h-5 text-white" />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-xs md:text-sm font-semibold text-brand mb-0.5 md:mb-1">
                              {option.subtitle}
                            </p>
                            <h3 className="text-base md:text-xl font-bold text-gray-900 mb-0.5 md:mb-2">
                              {option.title}
                            </h3>
                            <p className="text-xs md:text-sm text-gray-600 line-clamp-2 md:line-clamp-none md:mb-5">
                              {option.description}
                            </p>
                          </div>

                          {/* Mobile checkmark */}
                          {isSelected && (
                            <div className="md:hidden w-6 h-6 bg-brand rounded-full flex items-center justify-center shrink-0">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>

                        {/* Features - desktop only */}
                        <div className="hidden md:block space-y-2.5 pt-4 border-t border-gray-100">
                          {option.features.map((feature, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full bg-brand-50 flex items-center justify-center">
                                <feature.icon className="w-3.5 h-3.5 text-brand" />
                              </div>
                              <span className={`text-sm ${isSelected ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                                {feature.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>

              {errors.intent && (
                <motion.p 
                  variants={itemVariants} 
                  className="text-red-600 text-center mt-6 bg-red-50 py-3 px-4 rounded-xl"
                >
                  {errors.intent}
                </motion.p>
              )}
            </motion.div>
          )}

          {/* ============================================ */}
          {/* STEP 1: CATEGORY SELECTION */}
          {/* ============================================ */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
            >
              <div className="text-center mb-4 md:mb-10">
                <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-1 md:mb-3">
                  {intent === "need" ? "What do you need?" : "What are you offering?"}
                </h1>
                <p className="text-gray-500 text-sm md:text-lg">
                  {intent === "need"
                    ? "Select the category that best matches your request"
                    : "Choose what you'd like to list"
                  }
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-5">
                {(intent === "need" ? CATEGORIES.need : CATEGORIES.offer).map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.value;

                  return (
                    <motion.button
                      key={cat.value}
                      whileHover={{ y: -4, boxShadow: "0 12px 40px rgba(0,0,0,0.12)" }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setCategory(cat.value)}
                      className={`relative text-left rounded-xl md:rounded-2xl bg-white border-2 transition-all duration-200 overflow-hidden ${
                        isSelected
                          ? 'border-brand shadow-lg shadow-brand-500/10'
                          : 'border-gray-200 hover:border-gray-300 shadow-sm'
                      }`}
                    >
                      <div className={`absolute top-0 left-0 right-0 h-1 md:h-1.5 transition-all ${isSelected ? 'bg-gradient-to-r from-brand to-brand-500' : 'bg-gradient-to-r from-brand-200 to-brand-100'}`} />

                      {cat.popular && (
                        <div className="absolute top-2 right-2 md:top-4 md:right-4 z-10">
                          <div className="px-2 py-0.5 md:px-2.5 md:py-1 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 text-[9px] md:text-[10px] font-bold text-white shadow-sm">
                            POPULAR
                          </div>
                        </div>
                      )}

                      {/* Mobile: horizontal layout */}
                      <div className="md:hidden p-3 flex items-center gap-3">
                        <div className={`
                          w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 shrink-0
                          ${isSelected
                            ? 'bg-gradient-to-br from-brand to-brand-500 shadow-lg shadow-brand-500/30'
                            : 'bg-brand-50 border-2 border-brand-100'
                          }
                        `}>
                          <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-brand'}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-bold text-gray-900">{cat.label}</h3>
                          <p className="text-xs text-gray-600 line-clamp-1">
                            {cat.description}
                          </p>
                        </div>

                        {isSelected && (
                          <div className="w-6 h-6 bg-brand rounded-full flex items-center justify-center shrink-0">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Desktop: vertical layout */}
                      <div className="hidden md:block p-6 pt-4">
                        <div className={`
                          w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-all duration-200
                          ${isSelected
                            ? 'bg-gradient-to-br from-brand to-brand-500 shadow-lg shadow-brand-500/30'
                            : 'bg-brand-50 border-2 border-brand-100'
                          }
                        `}>
                          <Icon className={`w-7 h-7 ${isSelected ? 'text-white' : 'text-brand'}`} />
                        </div>

                        <h3 className="text-lg font-bold text-gray-900 mb-2">{cat.label}</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          {cat.description}
                        </p>

                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {cat.examples.slice(0, 3).map((ex, i) => (
                            <span key={i} className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                              isSelected ? 'bg-brand-50 text-brand' : 'bg-gray-100 text-gray-600'
                            }`}>{ex}</span>
                          ))}
                        </div>

                        {cat.earnings && (
                          <div className="pt-4 border-t border-gray-100 flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                              <PoundSterling className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                              <span className="text-sm font-bold text-green-600">{cat.earnings}</span>
                              <span className="text-xs text-gray-500 ml-1">typical</span>
                            </div>
                          </div>
                        )}

                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute bottom-4 right-4 w-8 h-8 bg-brand rounded-full flex items-center justify-center shadow-lg"
                          >
                            <Check className="w-5 h-5 text-white" />
                          </motion.div>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {errors.category && (
                <motion.p 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-600 text-center mt-6 bg-red-50 py-3 px-4 rounded-xl"
                >
                  {errors.category}
                </motion.p>
              )}
            </motion.div>
          )}

          {/* ============================================ */}
          {/* STEP 2: DETAILS + PRICING (Combined) */}
          {/* ============================================ */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
            >
              <div className="text-center mb-4 md:mb-10">
                {selectedCategory && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 mb-2 md:mb-3"
                  >
                    <selectedCategory.icon className="w-3.5 h-3.5 text-brand" />
                    <span className="text-xs md:text-sm font-semibold text-brand">{selectedCategory?.label}</span>
                  </motion.div>
                )}
                <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-1 md:mb-3">
                  {intent === "need"
                    ? "What exactly do you need?"
                    : "Describe your listing"
                  }
                </h1>
                <p className="text-gray-500 text-sm md:text-lg max-w-lg mx-auto">
                  {intent === "need"
                    ? "Tell us what you need, set your budget, and choose when you need it"
                    : "Add details, photos, and set your pricing"
                  }
                </p>
              </div>

              {/* AI Request Assistant - Only for requests */}
              {intent === "need" && (
                <AIRequestAssistant
                  category={category as 'TOOLS' | 'EXPERTISE' | 'SPACE'}
                  onSuggestionsGenerated={handleAIRequestGenerated}
                  className="mb-6"
                />
              )}

              {/* AI Listing Assistant - Only for offers */}
              {intent === "offer" && (
                <AIListingAssistant
                  listingType={category as 'tool' | 'space' | 'service'}
                  onSuggestionsGenerated={handleAISuggestionsGenerated}
                  className="mb-6"
                />
              )}

              {/* Details Section */}
              <div className="bg-white rounded-2xl border-2 border-gray-100 shadow-sm overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-brand-200 to-brand-100" />
                
                <div className="p-5 md:p-6 space-y-4">
                  {/* Title/Name */}
                  <div>
                    <Label className="text-gray-700 text-sm font-medium mb-1.5 block">
                      {intent === "need" ? "Job Title" : category === "service" ? "Service Title" : "Name"} *
                    </Label>
                    <Input
                      placeholder={
                        intent === "need" ? "e.g., Need diagnostic scanner for BMW E90" :
                        category === "tool" ? "e.g., Bosch GWS 18V-10 Angle Grinder" :
                        category === "space" ? "e.g., Double Bay with 2-Post Lift" :
                        "e.g., Mobile Mechanic - All Makes"
                      }
                      value={intent === "need" ? needData.title : category === "service" ? offerData.title : offerData.name}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        if (intent === "need") setNeedData(prev => ({ ...prev, title: e.target.value }));
                        else if (category === "service") setOfferData(prev => ({ ...prev, title: e.target.value }));
                        else setOfferData(prev => ({ ...prev, name: e.target.value }));
                      }}
                      onFocus={handleInputFocus}
                      className={`h-10 ${(errors.title || errors.name) ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                    />
                    {(errors.title || errors.name) && <p className="text-red-600 text-sm mt-1">{errors.title || errors.name}</p>}
                  </div>

                  {/* Description + Photos side by side */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-700 text-sm font-medium mb-1.5 block">Description *</Label>
                      <Textarea
                        placeholder={intent === "need"
                          ? "What do you need? Be specific about make/model, size, or requirements..."
                          : "Describe your listing in detail..."
                        }
                        value={intent === "need" ? needData.description : offerData.description}
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                          if (intent === "need") setNeedData(prev => ({ ...prev, description: e.target.value }));
                          else setOfferData(prev => ({ ...prev, description: e.target.value }));
                        }}
                        className={`min-h-[100px] md:min-h-[140px] h-[100px] md:h-[140px] resize-none ${errors.description ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                        onFocus={handleInputFocus}
                        onBlur={handleDescriptionBlur}
                        maxLength={1000}
                      />
                      {errors.description && <p className="text-red-600 text-sm mt-1">{errors.description}</p>}
                    </div>

                    <div>
                      <Label className="text-gray-700 text-sm font-medium mb-1.5 block">
                        Photos {(intent === "offer" && category !== "service") ? "*" : "(optional)"}
                      </Label>
                      <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 ${errors.photos ? 'ring-2 ring-red-500 rounded-lg p-1' : ''}`}>
                        {photoPreviews.map((preview, index) => (
                          <div key={index} className="relative aspect-square group rounded-lg overflow-hidden border border-gray-200">
                            <img src={preview} alt="" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removePhoto(index)}
                              className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-5 h-5 text-white" />
                            </button>
                            {index === 0 && (
                              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-brand rounded text-[10px] text-white">
                                Main
                              </div>
                            )}
                          </div>
                        ))}
                        {photoPreviews.length < 5 && (
                          <label className={`aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${
                            isUploading ? 'border-brand bg-brand/5' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                          }`}>
                            {isUploading ? (
                              <Loader2 className="w-5 h-5 text-brand animate-spin" />
                            ) : (
                              <>
                                <ImagePlus className="w-5 h-5 text-gray-400 mb-0.5" />
                                <span className="text-[10px] text-gray-500">{5 - photoPreviews.length} left</span>
                              </>
                            )}
                            <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" disabled={isUploading} />
                          </label>
                        )}
                      </div>
                      {errors.photos && <p className="text-red-600 text-sm mt-1">{errors.photos}</p>}
                    </div>
                  </div>

                  {/* Tool-specific: Category & Condition */}
                  {intent === "offer" && category === "tool" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-700 text-sm font-medium mb-1.5 block">Category</Label>
                        <Select value={offerData.toolCategory} onValueChange={(v) => setOfferData(prev => ({ ...prev, toolCategory: v }))}>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {TOOL_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-gray-700 text-sm font-medium mb-1.5 flex items-center gap-2">
                          Condition
                          {aiPrefilled.condition && (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600 font-normal">
                              <Check className="w-3 h-3" /> AI
                            </span>
                          )}
                        </Label>
                        <Select value={offerData.condition} onValueChange={(v) => {
                          setOfferData(prev => ({ ...prev, condition: v }));
                          setAiPrefilled(prev => ({ ...prev, condition: false }));
                        }}>
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TOOL_CONDITIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* Space features */}
                  {intent === "offer" && category === "space" && (
                    <div>
                      <Label className="text-gray-700 text-sm font-medium mb-1.5 flex items-center gap-2">
                        Features
                        {aiPrefilled.features && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-normal">
                            <Check className="w-3 h-3" /> AI
                          </span>
                        )}
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {SPACE_FEATURES.map(feature => (
                          <button
                            key={feature}
                            type="button"
                            onClick={() => toggleArrayItem('features', feature)}
                            className={`px-2.5 py-1 rounded-lg text-sm font-medium transition-all ${
                              offerData.features.includes(feature)
                                ? 'bg-brand text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >{feature}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Service specialties */}
                  {intent === "offer" && category === "service" && (
                    <div>
                      <Label className="text-gray-700 text-sm font-medium mb-1.5 flex items-center gap-2">
                        Specialties *
                        {aiPrefilled.specialties && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-normal">
                            <Check className="w-3 h-3" /> AI
                          </span>
                        )}
                      </Label>
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-lg bg-gray-50 border border-gray-200">
                        {SERVICE_SPECIALTIES.map(spec => (
                          <button
                            key={spec}
                            type="button"
                            onClick={() => toggleArrayItem('specialties', spec)}
                            className={`px-2.5 py-1 rounded-lg text-sm font-medium transition-all ${
                              offerData.specialties.includes(spec)
                                ? 'bg-brand text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                            }`}
                          >{spec}</button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{offerData.specialties.length} selected</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Budget & Location Section */}
              <div className="bg-white rounded-2xl border-2 border-gray-100 shadow-sm overflow-hidden mt-6">
                <div className="px-6 py-4 bg-gradient-to-r from-brand-50 to-brand-100 border-b border-brand-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-brand-500 flex items-center justify-center">
                      <PoundSterling className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {intent === "need" ? "Budget & Timing" : "Pricing & Location"}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {intent === "need" ? "How much and when?" : "Set competitive rates"}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 space-y-6">
                
                  {/* NEED: Budget & Urgency */}
                  {intent === "need" && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-gray-700 text-sm font-medium mb-2 block">Rate Type</Label>
                          <Select value={needData.rateType} onValueChange={(v) => setNeedData(prev => ({ ...prev, rateType: v }))}>
                            <SelectTrigger className="h-11">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="FIXED">Fixed Price</SelectItem>
                              <SelectItem value="HOURLY">Per Hour</SelectItem>
                              <SelectItem value="DAILY">Per Day</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-gray-700 text-sm font-medium mb-2 block">Budget *</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                            <AnimatedInput
                              type="number"
                              min="1"
                              placeholders={["50", "75", "100", "150", "200"]}
                              value={needData.budget}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => setNeedData(prev => ({ ...prev, budget: e.target.value }))}
                              className={`pl-7 h-11 ${errors.budget ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                            />
                          </div>
                          {errors.budget && <p className="text-red-600 text-sm mt-1">{errors.budget}</p>}
                        </div>
                      </div>

                      {/* Urgency */}
                      <div>
                        <Label className="text-gray-700 text-sm font-medium mb-3 block">When do you need it?</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {URGENCY_OPTIONS.map(opt => {
                            const Icon = opt.icon;
                            const isSelected = needData.urgency === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setNeedData(prev => ({ ...prev, urgency: opt.value }))}
                                className={`p-3 rounded-lg border-2 text-center transition-all ${
                                  isSelected 
                                    ? 'border-brand bg-brand/5' 
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <Icon className={`w-5 h-5 mx-auto mb-1 ${isSelected ? 'text-brand' : 'text-gray-400'}`} />
                                <div className={`text-sm font-semibold ${isSelected ? 'text-brand' : 'text-gray-700'}`}>{opt.label}</div>
                                <div className="text-xs text-gray-500">{opt.sublabel}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Search Radius */}
                      <div>
                        <Label className="text-gray-700 text-sm font-medium mb-2 flex items-center gap-2">
                          {needData.nationwideSearch ? <Globe className="w-4 h-4 text-brand" /> : <Target className="w-4 h-4 text-brand" />}
                          Search Radius: {needData.nationwideSearch ? 'Nationwide' : `${needData.broadcastRadius} miles`}
                        </Label>
                        {!needData.nationwideSearch && (
                          <input
                            type="range"
                            min="5"
                            max="100"
                            step="5"
                            value={needData.broadcastRadius}
                            onChange={(e) => setNeedData(prev => ({ ...prev, broadcastRadius: parseInt(e.target.value) }))}
                            className="w-full accent-brand"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setNeedData(prev => ({ ...prev, nationwideSearch: !prev.nationwideSearch }))}
                          className={`w-full p-3 rounded-lg border-2 flex items-center gap-3 transition-all ${
                            needData.nationwideSearch ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            needData.nationwideSearch ? 'border-brand bg-brand' : 'border-gray-300'
                          }`}>
                            {needData.nationwideSearch && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className="text-left">
                            <div className={needData.nationwideSearch ? 'text-gray-900 font-medium' : 'text-gray-700'}>Search nationwide</div>
                            <div className="text-xs text-gray-500">Find providers across the UK</div>
                          </div>
                        </button>
                      </div>
                    </>
                  )}

                  {/* OFFER: Pricing */}
                  {intent === "offer" && (
                    <div>
                      <Label className="text-gray-700 text-sm font-medium mb-3 block">Your Rates</Label>
                      <div className="grid grid-cols-2 gap-4">
                        {category === "tool" && (
                          <>
                            <div>
                              <Label className="text-gray-500 text-sm mb-2 block">Daily Rate *</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                                <Input type="number" min="1" placeholder="25" value={offerData.dailyRate}
                                  onChange={(e: ChangeEvent<HTMLInputElement>) => setOfferData(prev => ({ ...prev, dailyRate: e.target.value }))}
                                  className={`pl-7 h-11 ${errors.rate ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`} />
                              </div>
                            </div>
                            <div>
                              <Label className="text-gray-500 text-sm mb-2 block">Deposit</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                                <Input type="number" min="0" placeholder="50" value={offerData.deposit}
                                  onChange={(e: ChangeEvent<HTMLInputElement>) => setOfferData(prev => ({ ...prev, deposit: e.target.value }))}
                                  className="pl-7 h-11" />
                              </div>
                            </div>
                          </>
                        )}
                        {category === "space" && (
                          <>
                            <div>
                              <Label className="text-gray-500 text-sm mb-2 block">Hourly Rate</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                                <Input type="number" min="0" placeholder="15" value={offerData.hourlyRate}
                                  onChange={(e: ChangeEvent<HTMLInputElement>) => setOfferData(prev => ({ ...prev, hourlyRate: e.target.value }))}
                                  className="pl-7 h-11" />
                              </div>
                            </div>
                            <div>
                              <Label className="text-gray-500 text-sm mb-2 block">Daily Rate *</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                                <Input type="number" min="1" placeholder="80" value={offerData.dailyRate}
                                  onChange={(e: ChangeEvent<HTMLInputElement>) => setOfferData(prev => ({ ...prev, dailyRate: e.target.value }))}
                                  className={`pl-7 h-11 ${errors.rate ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`} />
                              </div>
                            </div>
                          </>
                        )}
                        {category === "service" && (
                          <>
                            <div>
                              <Label className="text-gray-500 text-sm mb-2 block">Hourly Rate *</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                                <Input type="number" min="1" placeholder="45" value={offerData.hourlyRate}
                                  onChange={(e: ChangeEvent<HTMLInputElement>) => setOfferData(prev => ({ ...prev, hourlyRate: e.target.value }))}
                                  className={`pl-7 h-11 ${errors.rate ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`} />
                              </div>
                            </div>
                            <div>
                              <Label className="text-gray-500 text-sm mb-2 block">Callout Fee</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                                <Input type="number" min="0" placeholder="25" value={offerData.calloutFee}
                                  onChange={(e: ChangeEvent<HTMLInputElement>) => setOfferData(prev => ({ ...prev, calloutFee: e.target.value }))}
                                  className="pl-7 h-11" />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      {errors.rate && <p className="text-red-600 text-sm mt-2">{errors.rate}</p>}

                      {/* Service radius */}
                      {category === "service" && (
                        <div className="mt-4">
                          <Label className="text-gray-700 text-sm font-medium mb-2 block">Service Radius: {offerData.radius} miles</Label>
                          <input type="range" min="5" max="100" step="5" value={offerData.radius}
                            onChange={(e) => setOfferData(prev => ({ ...prev, radius: parseInt(e.target.value) }))}
                            className="w-full accent-brand" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Location - Pre-filled from profile if available */}
                  <div>
                    <Label className="text-gray-700 text-sm font-medium mb-2 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-brand" />
                      {intent === "need" ? "Your Postcode" : "Location"} *
                    </Label>
                    <div className="relative">
                      <Input
                        placeholder="e.g., B1 1AA"
                        value={postcode}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setPostcode(e.target.value.toUpperCase())}
                        onFocus={handleInputFocus}
                        className={`h-11 uppercase tracking-wider ${(currentUser?.postcode || currentUser?.locationAddress) && postcode === (currentUser?.postcode || currentUser?.locationAddress) ? 'pr-28' : ''} ${errors.postcode ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                        maxLength={10}
                      />
                      {(currentUser?.postcode || currentUser?.locationAddress) && postcode === (currentUser?.postcode || currentUser?.locationAddress) && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          From profile
                        </span>
                      )}
                    </div>
                    {errors.postcode && <p className="text-red-600 text-sm mt-1">{errors.postcode}</p>}
                  </div>

                  {/* Sponsor Section */}
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <Label className="text-yellow-800 font-semibold flex items-center gap-2">
                          <Rocket className="w-4 h-4" />
                          {intent === "need" ? "Promote this request" : "Promote this listing"}
                        </Label>
                        <p className="text-sm text-gray-500">Get more visibility and appear higher in search results</p>
                      </div>
                      <Switch
                        checked={intent === "need" ? needData.sponsorEnabled : offerData.sponsorEnabled}
                        onCheckedChange={(checked) => {
                          if (intent === "need") {
                            setNeedData(prev => ({ ...prev, sponsorEnabled: checked }));
                          } else {
                            setOfferData(prev => ({ ...prev, sponsorEnabled: checked }));
                          }
                        }}
                      />
                    </div>

                    {(intent === "need" ? needData.sponsorEnabled : offerData.sponsorEnabled) && (
                      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-yellow-800">CPA Rate:</Label>
                          <span className="font-semibold text-yellow-900">
                            {intent === "need" ? needData.sponsorCpaPercent : offerData.sponsorCpaPercent}%
                          </span>
                        </div>
                        <Slider
                          value={[intent === "need" ? needData.sponsorCpaPercent : offerData.sponsorCpaPercent]}
                          onValueChange={([value]) => {
                            if (intent === "need") {
                              setNeedData(prev => ({ ...prev, sponsorCpaPercent: value }));
                            } else {
                              setOfferData(prev => ({ ...prev, sponsorCpaPercent: value }));
                            }
                          }}
                          min={5}
                          max={50}
                          step={1}
                          className="w-full"
                        />
                        <p className="text-xs text-yellow-700">
                          You&apos;ll pay {intent === "need" ? needData.sponsorCpaPercent : offerData.sponsorCpaPercent}% of the
                          {intent === "need" ? " agreed price " : " rental fee "}
                          only when a transaction completes. Higher rates = more visibility.
                        </p>
                      </div>
                    )}
                  </div>

                  {errors.submit && <p className="text-red-600 text-center font-medium mt-4">{errors.submit}</p>}
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

        {/* ============================================ */}
        {/* NAVIGATION BUTTONS - Desktop Only */}
        {/* ============================================ */}
        <motion.div
          className="hidden md:flex gap-4 mt-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {step > 0 && (
            <Button
              variant="outline"
              onClick={prevStep}
              className="flex-1 h-14 text-base font-medium border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-xl"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </Button>
          )}

          {step < 2 ? (
            <Button
              onClick={nextStep}
              disabled={step === 0 && !intent}
              className={`flex-1 h-14 text-base font-semibold text-white rounded-xl transition-all duration-200 ${
                step === 0 && !intent
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-brand to-brand-500 hover:from-brand-900 hover:to-brand-700 shadow-lg shadow-brand-500/25 hover:shadow-xl hover:shadow-brand-500/30'
              }`}
            >
              Continue
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || isModeratingContent}
              className="flex-1 h-14 text-base font-semibold text-white rounded-xl bg-gradient-to-r from-brand to-brand-500 hover:from-brand-900 hover:to-brand-700 shadow-lg shadow-brand-500/25 hover:shadow-xl hover:shadow-brand-500/30 transition-all duration-200"
            >
              {isModeratingContent ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Checking...</>
              ) : isSubmitting ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Creating...</>
              ) : (
                <>
                  <Rocket className="w-5 h-5 mr-2" />
                  {intent === "need" ? "Post Job" : "Create Listing"}
                </>
              )}
            </Button>
          )}
        </motion.div>
      </div>

      {/* ============================================ */}
      {/* MOBILE STICKY FOOTER NAVIGATION */}
      {/* Positioned above the bottom nav bar (72px) */}
      {/* ============================================ */}
      <div className="md:hidden fixed bottom-[72px] left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-30 px-4 py-3">
        <div className="flex gap-3 max-w-4xl mx-auto">
          {step > 0 && (
            <Button
              variant="outline"
              onClick={prevStep}
              className="flex-1 h-12 text-sm font-medium border-2 border-gray-200 rounded-xl"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back
            </Button>
          )}

          {step < 2 ? (
            <Button
              onClick={nextStep}
              disabled={step === 0 && !intent}
              className={`flex-1 h-12 text-sm font-semibold text-white rounded-xl transition-all ${
                step === 0 && !intent
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-brand to-brand-500 shadow-lg shadow-brand-500/25'
              }`}
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || isModeratingContent}
              className="flex-1 h-12 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-brand to-brand-500 shadow-lg shadow-brand-500/25 transition-all"
            >
              {isModeratingContent ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Checking...</>
              ) : isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Creating...</>
              ) : (
                <>
                  <Rocket className="w-4 h-4 mr-1.5" />
                  {intent === "need" ? "Post Job" : "Create Listing"}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
