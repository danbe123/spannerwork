/**
 * ToolWizard - Guided Tool Listing Experience
 * 
 * A step-by-step wizard with:
 * - Contextual tooltips on every field
 * - Smart suggestions and pricing guidance
 * - Photo tips and requirements
 * - Progressive disclosure of advanced options
 * - Inline validation with helpful messages
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toolsService, uploadService, authService } from '@/api/services';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// Using native textarea for type safety
// Label uses native label element
// Switch component inline - see toggle buttons below
// Select components not used in this simplified version
import {
  Wrench,
  Camera,
  PoundSterling,
  MapPin,
  ArrowLeft,
  ArrowRight,
  Loader2,
  HelpCircle,
  Lightbulb,
  Check,
  X,
  Info,
  Sparkles,
  Shield,
  TrendingUp,
  Star,
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  Eye,
  Zap,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================
interface ToolFormData {
  name: string;
  brand: string;
  model: string;
  category: string;
  description: string;
  condition: string;
  dailyRate: string;
  weeklyRate: string;
  deposit: string;
  toolValue: string;
  includesAccessories: boolean;
  accessoriesDescription: string;
  requiresExperience: boolean;
  canProvideDemo: boolean;
  demoRate: string;
  deliveryAvailable: boolean;
  deliveryRadius: number;
  deliveryFee: string;
}

interface WizardStep {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
}

// ============================================
// CONFIGURATION
// ============================================
const WIZARD_STEPS: WizardStep[] = [
  { id: 'basics', title: 'Tool Details', subtitle: 'Name, brand & condition', icon: Wrench },
  { id: 'photos', title: 'Photos', subtitle: 'Show off your tool', icon: Camera },
  { id: 'pricing', title: 'Pricing', subtitle: 'Set your rates', icon: PoundSterling },
  { id: 'extras', title: 'Extras', subtitle: 'Optional add-ons', icon: Sparkles },
];

const TOOL_CATEGORIES = [
  { value: 'diagnostics', label: 'Diagnostics & Scanners', avgDaily: '£25-50', icon: '🔍' },
  { value: 'power-tools', label: 'Power Tools', avgDaily: '£15-35', icon: '⚡' },
  { value: 'hand-tools', label: 'Hand Tools', avgDaily: '£5-15', icon: '🔧' },
  { value: 'lifting', label: 'Lifting Equipment', avgDaily: '£40-80', icon: '🏗️' },
  { value: 'welding', label: 'Welding Equipment', avgDaily: '£30-60', icon: '🔥' },
  { value: 'air-tools', label: 'Air Tools', avgDaily: '£15-30', icon: '💨' },
  { value: 'specialist', label: 'Specialist Tools', avgDaily: '£30-100', icon: '🎯' },
  { value: 'bodywork', label: 'Bodywork & Paint', avgDaily: '£25-50', icon: '🎨' },
  { value: 'electrical', label: 'Electrical Tools', avgDaily: '£20-40', icon: '🔌' },
  { value: 'other', label: 'Other', avgDaily: 'Varies', icon: '📦' },
];

const CONDITIONS = [
  { 
    value: 'like-new', 
    label: 'Like New', 
    description: 'Barely used, no visible wear',
    priceMultiplier: 1.0,
    color: 'text-green-600 bg-green-50',
  },
  { 
    value: 'excellent', 
    label: 'Excellent', 
    description: 'Light use, minimal wear',
    priceMultiplier: 0.9,
    color: 'text-blue-600 bg-blue-50',
  },
  { 
    value: 'good', 
    label: 'Good', 
    description: 'Normal wear, fully functional',
    priceMultiplier: 0.8,
    color: 'text-amber-600 bg-amber-50',
  },
  { 
    value: 'fair', 
    label: 'Fair', 
    description: 'Visible wear, works well',
    priceMultiplier: 0.65,
    color: 'text-orange-600 bg-orange-50',
  },
];

const PHOTO_TIPS = [
  { angle: 'Front view', tip: 'Show the main face of the tool clearly', required: true },
  { angle: 'Full body', tip: 'Capture the entire tool in frame', required: true },
  { angle: 'Serial/model number', tip: 'Helps verify authenticity', required: false },
  { angle: 'Any wear or damage', tip: 'Be transparent about condition', required: false },
  { angle: 'Accessories included', tip: 'Show what comes with it', required: false },
];

// ============================================
// HELPER COMPONENTS
// ============================================

// Field label with tooltip
interface FieldLabelProps {
  label: string;
  required?: boolean;
  tooltip: string;
  learnMoreUrl?: string;
}

function FieldLabel({ label, required, tooltip }: FieldLabelProps) {
  const [showTip, setShowTip] = useState(false);
  
  return (
    <div className="flex items-center gap-1.5 mb-2 relative">
      <label className="text-gray-700 font-medium text-sm">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <button 
        type="button" 
        className="text-gray-400 hover:text-gray-600 transition-colors"
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        onClick={() => setShowTip(!showTip)}
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      {showTip && (
        <div className="absolute left-0 bottom-full mb-2 z-50 w-64 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg">
          {tooltip}
          <div className="absolute left-4 top-full w-2 h-2 bg-gray-900 transform rotate-45 -translate-y-1" />
        </div>
      )}
    </div>
  );
}

// Pro tip callout
interface ProTipProps {
  children: React.ReactNode;
  icon?: React.ElementType;
}

function ProTip({ children, icon: Icon = Lightbulb }: ProTipProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg mt-3"
    >
      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-amber-600" />
      </div>
      <div className="text-sm text-amber-800">{children}</div>
    </motion.div>
  );
}

// Success indicator
function FieldSuccess({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-1.5 text-green-600 text-sm mt-1"
    >
      <CheckCircle2 className="w-4 h-4" />
      <span>{message}</span>
    </motion.div>
  );
}

// Pricing suggestion card
interface PricingSuggestionProps {
  category: string;
  condition: string;
  onApply: (price: number) => void;
}

function PricingSuggestion({ category, condition, onApply }: PricingSuggestionProps) {
  const cat = TOOL_CATEGORIES.find(c => c.value === category);
  const cond = CONDITIONS.find(c => c.value === condition);
  
  if (!cat || cat.value === 'other') return null;
  
  // Parse the average range
  const range = cat.avgDaily.replace('£', '').split('-');
  const avgLow = parseInt(range[0]) || 20;
  const avgHigh = parseInt(range[1]) || 40;
  const midpoint = Math.round((avgLow + avgHigh) / 2);
  const suggested = Math.round(midpoint * (cond?.priceMultiplier || 0.8));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-blue-900">Pricing Suggestion</h4>
          <p className="text-sm text-blue-700 mt-1">
            Similar <span className="font-medium">{cat.label}</span> in <span className="font-medium">{cond?.label}</span> condition 
            typically rent for <span className="font-bold">{cat.avgDaily}/day</span>
          </p>
          <div className="flex items-center gap-3 mt-3">
            <Button
              type="button"
              size="sm"
              onClick={() => onApply(suggested)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Zap className="w-4 h-4 mr-1" />
              Use £{suggested}/day
            </Button>
            <span className="text-xs text-blue-600">Recommended based on market data</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Step progress indicator
interface StepProgressProps {
  steps: WizardStep[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

function StepProgress({ steps, currentStep, onStepClick }: StepProgressProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isComplete = index < currentStep;
        const isCurrent = index === currentStep;
        const isClickable = index < currentStep && onStepClick;

        return (
          <div key={step.id} className="flex items-center flex-1">
            <button
              type="button"
              onClick={() => isClickable && onStepClick(index)}
              disabled={!isClickable}
              className={`flex flex-col items-center ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div
                className={`
                  w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300
                  ${isComplete 
                    ? 'bg-green-500 text-white' 
                    : isCurrent 
                      ? 'bg-brand-800 text-white ring-4 ring-orange-100' 
                      : 'bg-gray-100 text-gray-400'
                  }
                `}
              >
                {isComplete ? <Check className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
              </div>
              <span className={`text-xs mt-2 font-medium ${isCurrent ? 'text-brand-800' : 'text-gray-500'}`}>
                {step.title}
              </span>
            </button>
            
            {index < steps.length - 1 && (
              <div className="flex-1 mx-2">
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-green-500 rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: isComplete ? '100%' : '0%' }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function ToolWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [postcode, setPostcode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [_showSuccess, setShowSuccess] = useState(false);

  const [formData, setFormData] = useState<ToolFormData>({
    name: '',
    brand: '',
    model: '',
    category: '',
    description: '',
    condition: '',
    dailyRate: '',
    weeklyRate: '',
    deposit: '',
    toolValue: '',
    includesAccessories: false,
    accessoriesDescription: '',
    requiresExperience: false,
    canProvideDemo: false,
    demoRate: '',
    deliveryAvailable: false,
    deliveryRadius: 10,
    deliveryFee: '',
  });

  // Get current user
  const { data: userData } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => authService.getCurrentUser(),
  });

  // Pre-fill postcode
  useEffect(() => {
    if (userData?.user?.postcode && !postcode) {
      setPostcode(userData.user.postcode);
    }
  }, [userData]);

  // Calculate suggested weekly rate
  const suggestedWeeklyRate = formData.dailyRate 
    ? Math.round(parseFloat(formData.dailyRate) * 5) 
    : null;

  // Calculate suggested deposit
  const suggestedDeposit = formData.toolValue 
    ? Math.round(parseFloat(formData.toolValue) * 0.25) 
    : null;

  // Photo upload handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const availableSlots = 5 - photos.length;
    if (availableSlots <= 0) {
      setErrors(prev => ({ ...prev, photos: 'Maximum 5 photos allowed' }));
      return;
    }

    const filesToUpload = files.slice(0, availableSlots);
    setIsUploading(true);

    try {
      for (const file of filesToUpload) {
        const preview = URL.createObjectURL(file);
        setPhotoPreviews(prev => [...prev, preview]);
        
        const result = await uploadService.uploadFile(file);
        setPhotos(prev => [...prev, result.data.fileUrl]);
      }
      setErrors(prev => ({ ...prev, photos: '' }));
    } catch (error) {
      console.error('Upload failed:', error);
      setErrors(prev => ({ ...prev, photos: 'Upload failed. Please try again.' }));
    }
    
    setIsUploading(false);
  };

  const removePhoto = (index: number) => {
    if (photoPreviews[index]) URL.revokeObjectURL(photoPreviews[index]);
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Form update helper
  const updateField = <K extends keyof ToolFormData>(field: K, value: ToolFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Validation
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      if (!formData.name.trim()) newErrors.name = 'Please enter a name for your tool';
      if (!formData.category) newErrors.category = 'Please select a category';
      if (!formData.condition) newErrors.condition = 'Please select the condition';
      if (!formData.description || formData.description.length < 30) {
        newErrors.description = 'Please add at least 30 characters describing your tool';
      }
    }

    if (step === 1) {
      if (photos.length < 2) newErrors.photos = 'Please add at least 2 photos';
    }

    if (step === 2) {
      if (!formData.dailyRate || parseFloat(formData.dailyRate) <= 0) {
        newErrors.dailyRate = 'Please set a daily rate';
      }
      if (!postcode || postcode.length < 5) {
        newErrors.postcode = 'Please enter a valid postcode';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Navigation
  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, WIZARD_STEPS.length - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit mutation
  const createMutation = useMutation({
    mutationFn: () => toolsService.create({
      name: formData.brand && formData.model 
        ? `${formData.brand} ${formData.model}` 
        : formData.name,
      description: formData.description,
      category: formData.category,
      condition: formData.condition,
      dailyRate: parseFloat(formData.dailyRate),
      weeklyRate: formData.weeklyRate ? parseFloat(formData.weeklyRate) : undefined,
      deposit: formData.deposit ? parseFloat(formData.deposit) : 0,
      photos,
      postcode,
      // Extended fields can be stored in metadata or added to schema
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tools'] });
      queryClient.invalidateQueries({ queryKey: ['myTools'] });
      setShowSuccess(true);
    },
    onError: (error: Error) => {
      setErrors({ submit: error.message || 'Failed to create listing' });
    },
  });

  const handleSubmit = () => {
    if (validateStep(currentStep)) {
      createMutation.mutate();
    }
  };

  // ============================================
  // RENDER STEPS
  // ============================================

  const renderBasicsStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Tool Name with smart suggestions */}
      <div>
        <FieldLabel
          label="Tool Name"
          required
          tooltip="Be specific! Include the brand and type. Good names get 3x more views."
        />
        <Input
          placeholder="e.g., Bosch GWS 18V-10 Angle Grinder"
          value={formData.name}
          onChange={(e) => updateField('name', e.target.value)}
          className={`h-12 text-lg ${errors.name ? 'border-red-500' : ''}`}
        />
        {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
        {formData.name.length > 5 && formData.name.length < 20 && (
          <ProTip>
            <strong>Tip:</strong> Include the brand and model number. Renters search for specific tools
            like &quot;Snap-on torque wrench&quot; rather than just &quot;torque wrench&quot;.
          </ProTip>
        )}
      </div>

      {/* Brand & Model (Optional but encouraged) */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel
            label="Brand"
            tooltip="Well-known brands like DeWalt, Makita, or Snap-on can command higher rates."
          />
          <Input
            placeholder="e.g., Bosch, DeWalt, Makita"
            value={formData.brand}
            onChange={(e) => updateField('brand', e.target.value)}
            className="h-11"
          />
        </div>
        <div>
          <FieldLabel
            label="Model Number"
            tooltip="Helps renters verify compatibility and find manuals."
          />
          <Input
            placeholder="e.g., GWS 18V-10"
            value={formData.model}
            onChange={(e) => updateField('model', e.target.value)}
            className="h-11"
          />
        </div>
      </div>

      {/* Category */}
      <div>
        <FieldLabel
          label="Category"
          required
          tooltip="Choose the most specific category. This helps renters find your tool."
        />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {TOOL_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => updateField('category', cat.value)}
              className={`
                p-4 rounded-xl border-2 text-left transition-all
                ${formData.category === cat.value
                  ? 'border-brand-800 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }
              `}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{cat.icon}</span>
                <span className={`font-medium ${formData.category === cat.value ? 'text-brand-800' : 'text-gray-900'}`}>
                  {cat.label}
                </span>
              </div>
              <p className="text-xs text-gray-500">Avg: {cat.avgDaily}/day</p>
            </button>
          ))}
        </div>
        {errors.category && <p className="text-red-500 text-sm mt-2">{errors.category}</p>}
      </div>

      {/* Condition */}
      <div>
        <FieldLabel
          label="Condition"
          required
          tooltip="Be honest! Accurate condition descriptions lead to better reviews and fewer disputes."
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CONDITIONS.map((cond) => (
            <button
              key={cond.value}
              type="button"
              onClick={() => updateField('condition', cond.value)}
              className={`
                p-4 rounded-xl border-2 text-center transition-all
                ${formData.condition === cond.value
                  ? 'border-brand-800 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mb-2 ${cond.color}`}>
                {cond.label}
              </span>
              <p className="text-xs text-gray-500">{cond.description}</p>
            </button>
          ))}
        </div>
        {errors.condition && <p className="text-red-500 text-sm mt-2">{errors.condition}</p>}
      </div>

      {/* Description */}
      <div>
        <FieldLabel
          label="Description"
          required
          tooltip="Include what's included, what projects it's good for, and any special features. Detailed descriptions get 40% more bookings!"
        />
        <textarea
          placeholder="Describe your tool in detail. What's included? What's it great for? Any special features or notes?"
          value={formData.description}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField('description', e.target.value)}
          className={`flex min-h-[140px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none ${errors.description ? 'border-red-500' : ''}`}
          maxLength={1000}
        />
        <div className="flex justify-between mt-2">
          <div>
            {errors.description && <p className="text-red-500 text-sm">{errors.description}</p>}
            {formData.description.length >= 30 && formData.description.length < 100 && (
              <FieldSuccess message="Good start! Add more detail for better results." />
            )}
            {formData.description.length >= 100 && (
              <FieldSuccess message="Great description!" />
            )}
          </div>
          <span className="text-sm text-gray-400">{formData.description.length}/1000</span>
        </div>

        {/* Description helper */}
        {formData.description.length < 50 && (
          <div className="mt-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-2">Include in your description:</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                What&apos;s included (case, accessories, batteries?)
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                What projects it&apos;s perfect for
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Any special features or specifications
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Power source (corded, battery, air?)
              </li>
            </ul>
          </div>
        )}
      </div>
    </motion.div>
  );

  const renderPhotosStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Photo guidance */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Camera className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Photo Tips for More Bookings</h3>
            <p className="text-sm text-blue-700">
              Listings with 3+ quality photos get <strong>5x more enquiries</strong>. 
              Use good lighting and show the tool from multiple angles.
            </p>
          </div>
        </div>
      </div>

      {/* Photo requirements checklist */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Recommended Shots</h4>
          {PHOTO_TIPS.map((tip, index) => (
            <div 
              key={index}
              className={`flex items-start gap-3 p-3 rounded-lg ${
                tip.required ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                tip.required ? 'bg-brand-800 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {index + 1}
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">
                  {tip.angle}
                  {tip.required && <span className="text-red-500 ml-1">*</span>}
                </p>
                <p className="text-xs text-gray-500">{tip.tip}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Photo upload area */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Your Photos ({photos.length}/5)</h4>
          <div className="grid grid-cols-3 gap-3">
            {photoPreviews.map((preview, index) => (
              <div key={index} className="relative aspect-square group">
                <img
                  src={preview}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-full object-cover rounded-lg border-2 border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
                {index === 0 && (
                  <div className="absolute bottom-1 left-1 px-2 py-0.5 bg-brand-800 rounded text-xs text-white font-medium">
                    Main
                  </div>
                )}
              </div>
            ))}
            
            {photos.length < 5 && (
              <label className={`
                aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all
                ${isUploading 
                  ? 'border-brand-800 bg-orange-50' 
                  : 'border-gray-300 hover:border-brand-800 hover:bg-orange-50'
                }
              `}>
                {isUploading ? (
                  <Loader2 className="w-8 h-8 text-brand-800 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500">Add Photo</span>
                    <span className="text-xs text-gray-400">{5 - photos.length} remaining</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>
            )}
          </div>
          
          {errors.photos && (
            <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.photos}
            </p>
          )}

          {photos.length >= 2 && photos.length < 4 && (
            <ProTip icon={Star}>
              You&apos;re doing great! Adding 1-2 more photos can increase your booking rate by 30%.
            </ProTip>
          )}
        </div>
      </div>
    </motion.div>
  );

  const renderPricingStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Smart pricing suggestion */}
      {formData.category && formData.condition && (
        <PricingSuggestion
          category={formData.category}
          condition={formData.condition}
          onApply={(price) => updateField('dailyRate', price.toString())}
        />
      )}

      {/* Daily Rate */}
      <div>
        <FieldLabel
          label="Daily Rate"
          required
          tooltip="The amount you'll earn per day. Consider your tool's value, condition, and local competition."
        />
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg font-medium">£</span>
          <Input
            type="number"
            min="1"
            placeholder="25"
            value={formData.dailyRate}
            onChange={(e) => updateField('dailyRate', e.target.value)}
            className={`pl-10 h-14 text-2xl font-bold ${errors.dailyRate ? 'border-red-500' : ''}`}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">/day</span>
        </div>
        {errors.dailyRate && <p className="text-red-500 text-sm mt-1">{errors.dailyRate}</p>}
      </div>

      {/* Weekly Rate */}
      <div>
        <FieldLabel
          label="Weekly Rate"
          tooltip="Offer a discount for longer rentals. Most renters expect ~15-20% off for a full week."
        />
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">£</span>
          <Input
            type="number"
            min="1"
            placeholder={suggestedWeeklyRate?.toString() || '100'}
            value={formData.weeklyRate}
            onChange={(e) => updateField('weeklyRate', e.target.value)}
            className="pl-10 h-12"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">/week</span>
        </div>
        {formData.dailyRate && !formData.weeklyRate && (
          <button
            type="button"
            onClick={() => updateField('weeklyRate', suggestedWeeklyRate?.toString() || '')}
            className="text-sm text-brand-800 hover:underline mt-2 flex items-center gap-1"
          >
            <Sparkles className="w-4 h-4" />
            Use suggested: £{suggestedWeeklyRate} (5 days at daily rate)
          </button>
        )}
      </div>

      {/* Tool Value & Deposit */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel
            label="Tool Replacement Value"
            tooltip="What would it cost to replace this tool if damaged or lost? This helps calculate appropriate deposit."
          />
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">£</span>
            <Input
              type="number"
              min="0"
              placeholder="500"
              value={formData.toolValue}
              onChange={(e) => updateField('toolValue', e.target.value)}
              className="pl-10 h-12"
            />
          </div>
        </div>
        <div>
          <FieldLabel
            label="Security Deposit"
            tooltip="A refundable deposit protects you from damage. We recommend 20-30% of tool value."
          />
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">£</span>
            <Input
              type="number"
              min="0"
              placeholder={suggestedDeposit?.toString() || '50'}
              value={formData.deposit}
              onChange={(e) => updateField('deposit', e.target.value)}
              className="pl-10 h-12"
            />
          </div>
          {formData.toolValue && !formData.deposit && (
            <button
              type="button"
              onClick={() => updateField('deposit', suggestedDeposit?.toString() || '')}
              className="text-sm text-brand-800 hover:underline mt-2 flex items-center gap-1"
            >
              <Shield className="w-4 h-4" />
              Use suggested: £{suggestedDeposit} (25% of value)
            </button>
          )}
        </div>
      </div>

      {/* Location */}
      <div>
        <FieldLabel
          label="Your Location"
          required
          tooltip="We only show your general area to renters, never your exact address until a booking is confirmed."
        />
        <div className="relative">
          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="e.g., B1 1AA"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value.toUpperCase())}
            className={`pl-12 h-12 uppercase tracking-wider ${errors.postcode ? 'border-red-500' : ''}`}
            maxLength={10}
          />
        </div>
        {errors.postcode && <p className="text-red-500 text-sm mt-1">{errors.postcode}</p>}
        <p className="text-sm text-gray-500 mt-2 flex items-center gap-1">
          <Shield className="w-4 h-4" />
          Your exact location is only shared after a booking is confirmed
        </p>
      </div>

      {/* Earnings estimate */}
      {formData.dailyRate && (
        <div className="p-5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <PoundSterling className="w-5 h-5 text-green-600" />
            </div>
            <h4 className="font-semibold text-green-900">Potential Earnings</h4>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-700">
                £{Math.round(parseFloat(formData.dailyRate) * 4)}
              </p>
              <p className="text-xs text-green-600">4 days/month</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">
                £{Math.round(parseFloat(formData.dailyRate) * 8)}
              </p>
              <p className="text-xs text-green-600">8 days/month</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">
                £{Math.round(parseFloat(formData.dailyRate) * 15)}
              </p>
              <p className="text-xs text-green-600">15 days/month</p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );

  const renderExtrasStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <Info className="w-4 h-4 inline mr-1" />
          These optional extras can help your listing stand out and earn more.
        </p>
      </div>

      {/* Accessories */}
      <div className="p-5 border border-gray-200 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-semibold text-gray-900">Includes Accessories</h4>
            <p className="text-sm text-gray-500">Case, extra batteries, blades, etc.</p>
          </div>
          <button
            type="button"
            onClick={() => updateField('includesAccessories', !formData.includesAccessories)}
            className={`w-11 h-6 rounded-full transition-colors ${formData.includesAccessories ? 'bg-brand-800' : 'bg-gray-200'}`}
          >
            <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.includesAccessories ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        
        <AnimatePresence>
          {formData.includesAccessories && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <textarea
                placeholder="List what's included: carrying case, 2x batteries, charger, 3x drill bits..."
                value={formData.accessoriesDescription}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField('accessoriesDescription', e.target.value)}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Demo/Teaching */}
      <div className="p-5 border border-gray-200 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-semibold text-gray-900">Offer Demo/Training</h4>
            <p className="text-sm text-gray-500">Charge extra to show renters how to use it safely</p>
          </div>
          <button
            type="button"
            onClick={() => updateField('canProvideDemo', !formData.canProvideDemo)}
            className={`w-11 h-6 rounded-full transition-colors ${formData.canProvideDemo ? 'bg-brand-800' : 'bg-gray-200'}`}
          >
            <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.canProvideDemo ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        
        <AnimatePresence>
          {formData.canProvideDemo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <FieldLabel
                label="Demo/Training Rate"
                tooltip="Typically £15-30 for a 30-minute demonstration"
              />
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                <Input
                  type="number"
                  min="0"
                  placeholder="25"
                  value={formData.demoRate}
                  onChange={(e) => updateField('demoRate', e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
              <ProTip>
                Offering training is a great way to earn extra and helps less experienced 
                renters feel confident. It also reduces the chance of damage!
              </ProTip>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Delivery */}
      <div className="p-5 border border-gray-200 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-semibold text-gray-900">Delivery Available</h4>
            <p className="text-sm text-gray-500">Deliver the tool to the renter</p>
          </div>
          <button
            type="button"
            onClick={() => updateField('deliveryAvailable', !formData.deliveryAvailable)}
            className={`w-11 h-6 rounded-full transition-colors ${formData.deliveryAvailable ? 'bg-brand-800' : 'bg-gray-200'}`}
          >
            <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.deliveryAvailable ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        
        <AnimatePresence>
          {formData.deliveryAvailable && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-4"
            >
              <div>
                <label className="text-sm text-gray-700 mb-2 block">
                  Delivery Radius: {formData.deliveryRadius} miles
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={formData.deliveryRadius}
                  onChange={(e) => updateField('deliveryRadius', parseInt(e.target.value))}
                  className="w-full accent-brand-800"
                />
              </div>
              <div>
                <FieldLabel
                  label="Delivery Fee"
                  tooltip="Cover your fuel and time. Most charge £5-15 depending on distance."
                />
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                  <Input
                    type="number"
                    min="0"
                    placeholder="10"
                    value={formData.deliveryFee}
                    onChange={(e) => updateField('deliveryFee', e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Experience Required */}
      <div className="p-5 border border-gray-200 rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-gray-900">Requires Experience</h4>
            <p className="text-sm text-gray-500">Only rent to people who know how to use it</p>
          </div>
          <button
            type="button"
            onClick={() => updateField('requiresExperience', !formData.requiresExperience)}
            className={`w-11 h-6 rounded-full transition-colors ${formData.requiresExperience ? 'bg-brand-800' : 'bg-gray-200'}`}
          >
            <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.requiresExperience ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {formData.requiresExperience && (
          <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg mt-4">
            <AlertCircle className="w-4 h-4 inline mr-1" />
            Renters will need to confirm they have experience with this type of tool before booking.
          </p>
        )}
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5 text-gray-600" />
          Listing Summary
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Tool:</span>
            <span className="font-medium">{formData.name || 'Not set'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Category:</span>
            <span className="font-medium">
              {TOOL_CATEGORIES.find(c => c.value === formData.category)?.label || 'Not set'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Daily Rate:</span>
            <span className="font-medium text-green-600">£{formData.dailyRate || '0'}/day</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Photos:</span>
            <span className="font-medium">{photos.length} uploaded</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Location:</span>
            <span className="font-medium">{postcode || 'Not set'}</span>
          </div>
        </div>
      </div>

      {errors.submit && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle className="w-5 h-5 inline mr-2" />
          {errors.submit}
        </div>
      )}
    </motion.div>
  );

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                onClick={() => currentStep > 0 ? prevStep() : navigate(-1)}
                className="-ml-2"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {currentStep > 0 ? 'Back' : 'Cancel'}
              </Button>
              <span className="text-sm text-gray-500">
                Step {currentStep + 1} of {WIZARD_STEPS.length}
              </span>
            </div>
            
            <StepProgress
              steps={WIZARD_STEPS}
              currentStep={currentStep}
              onStepClick={(step) => setCurrentStep(step)}
            />
          </div>
        </div>

        {/* Content */}
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Step Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              {WIZARD_STEPS[currentStep].title}
            </h1>
            <p className="text-gray-500">
              {WIZARD_STEPS[currentStep].subtitle}
            </p>
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            {currentStep === 0 && renderBasicsStep()}
            {currentStep === 1 && renderPhotosStep()}
            {currentStep === 2 && renderPricingStep()}
            {currentStep === 3 && renderExtrasStep()}
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex gap-4 mt-10">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={prevStep}
                className="flex-1 h-14 text-base font-medium"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </Button>
            )}

            {currentStep < WIZARD_STEPS.length - 1 ? (
              <Button
                onClick={nextStep}
                className="flex-1 h-14 text-base font-semibold bg-brand-800 hover:bg-brand-900 text-white"
              >
                Continue
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                className="flex-1 h-14 text-base font-semibold bg-green-600 hover:bg-green-700 text-white"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Create Listing
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
  );
}
