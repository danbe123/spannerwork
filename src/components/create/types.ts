/**
 * Type definitions and constants for the Create wizard
 */

import { LucideIcon } from "lucide-react";
import { Variants } from "framer-motion";
import {
  Wrench,
  GraduationCap,
  Building2,
  Briefcase,
  Search,
  HandHeart,
  Zap,
  Clock,
  Calendar,
  CalendarDays,
  TrendingUp,
  Shield,
  Star,
  Users,
} from "lucide-react";

// ============================================
// FORM DATA TYPES
// ============================================

export interface NeedData {
  title: string;
  description: string;
  budget: string;
  rateType: string;
  urgency: string;
  broadcastRadius: number;
  nationwideSearch: boolean;
  sponsorEnabled: boolean;
  sponsorCpaPercent: number;
}

export interface OfferData {
  name: string;
  title: string;
  description: string;
  dailyRate: string;
  hourlyRate: string;
  weeklyRate: string;
  deposit: string;
  calloutFee: string;
  condition: string;
  toolCategory: string;
  features: string[];
  specialties: string[];
  radius: number;
  sponsorEnabled: boolean;
  sponsorCpaPercent: number;
}

export interface FormErrors {
  intent?: string;
  category?: string;
  title?: string;
  name?: string;
  description?: string;
  rate?: string;
  budget?: string;
  postcode?: string;
  photos?: string;
  submit?: string;
}

// ============================================
// CONFIGURATION TYPES
// ============================================

export interface CategoryOption {
  value: string;
  label: string;
  icon: LucideIcon;
  description: string;
  gradient: string;
  examples: string[];
  popular?: boolean;
  earnings?: string;
}

export interface IntentOption {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  glowColor: string;
  features: { icon: LucideIcon; text: string }[];
}

export interface UrgencyOption {
  value: string;
  label: string;
  sublabel: string;
  icon: LucideIcon;
  color: string;
}

export interface ToolConditionOption {
  value: string;
  label: string;
  description: string;
}

// ============================================
// INITIAL STATE
// ============================================

export const INITIAL_NEED_DATA: NeedData = {
  title: "",
  description: "",
  budget: "",
  rateType: "FIXED",
  urgency: "FLEXIBLE",
  broadcastRadius: 25,
  nationwideSearch: false,
  sponsorEnabled: false,
  sponsorCpaPercent: 5
};

export const INITIAL_OFFER_DATA: OfferData = {
  name: "",
  title: "",
  description: "",
  dailyRate: "",
  hourlyRate: "",
  weeklyRate: "",
  deposit: "",
  calloutFee: "",
  condition: "GOOD",
  toolCategory: "",
  features: [],
  specialties: [],
  radius: 15,
  sponsorEnabled: false,
  sponsorCpaPercent: 5
};

// ============================================
// INTENT OPTIONS (Step 0)
// ============================================

export const INTENTS: IntentOption[] = [
  {
    id: "need",
    title: "I need something",
    subtitle: "Post a job request",
    description: "Find tools, expertise, or workshop space from our trusted community",
    icon: Search,
    gradient: "from-violet-600 via-purple-600 to-indigo-700",
    glowColor: "violet",
    features: [
      { icon: Users, text: "Local mechanics near you" },
      { icon: Zap, text: "Get responses fast" },
      { icon: Shield, text: "Verified providers" }
    ]
  },
  {
    id: "offer",
    title: "I have something to offer",
    subtitle: "List your tools, space, or services",
    description: "Turn your equipment, workspace, or skills into extra income",
    icon: HandHeart,
    gradient: "from-emerald-500 via-teal-500 to-cyan-600",
    glowColor: "emerald",
    features: [
      { icon: TrendingUp, text: "Earn extra income" },
      { icon: Star, text: "Set your own rates" },
      { icon: Shield, text: "Protected transactions" }
    ]
  }
];

// ============================================
// CATEGORY OPTIONS
// ============================================

export const CATEGORIES: Record<string, CategoryOption[]> = {
  need: [
    {
      value: "TOOLS",
      label: "Tools & Equipment",
      icon: Wrench,
      description: "Specialist tools, diagnostics, power equipment",
      gradient: "from-orange-500 to-red-600",
      examples: ["OBD Scanner", "Hydraulic Press", "Engine Hoist", "Timing Kit"],
      popular: true
    },
    {
      value: "EXPERTISE",
      label: "Skills & Help",
      icon: GraduationCap,
      description: "Skilled mechanics, specialist knowledge",
      gradient: "from-blue-500 to-indigo-600",
      examples: ["Gearbox Rebuild", "ECU Programming", "Welding", "Diagnostics"]
    },
    {
      value: "SPACE",
      label: "Workshop Space",
      icon: Building2,
      description: "Ramps, lifts, bays, covered workspace",
      gradient: "from-emerald-500 to-teal-600",
      examples: ["2-Post Lift", "MOT Bay", "Spray Booth", "Inspection Pit"]
    }
  ],
  offer: [
    {
      value: "tool",
      label: "Tool or Equipment",
      icon: Wrench,
      description: "Rent out your specialist tools",
      gradient: "from-orange-500 to-red-600",
      examples: ["Diagnostic Scanner", "Hydraulic Press", "Specialist Tools"],
      earnings: "£15-50/day",
      popular: true
    },
    {
      value: "space",
      label: "Workshop Space",
      icon: Building2,
      description: "Rent out your workshop or bay",
      gradient: "from-emerald-500 to-teal-600",
      examples: ["2-Post Lift Bay", "MOT Bay", "Covered Workspace"],
      earnings: "£50-150/day"
    },
    {
      value: "service",
      label: "Your Expertise",
      icon: Briefcase,
      description: "Offer your skills and services",
      gradient: "from-blue-500 to-indigo-600",
      examples: ["Mobile Mechanic", "ECU Tuning", "Diagnostics Expert"],
      earnings: "£30-80/hour"
    }
  ]
};

// ============================================
// URGENCY OPTIONS
// ============================================

export const URGENCY_OPTIONS: UrgencyOption[] = [
  { value: "ASAP", label: "ASAP", sublabel: "Within hours", icon: Zap, color: "from-red-500 to-orange-500" },
  { value: "TODAY", label: "Today", sublabel: "By end of day", icon: Clock, color: "from-orange-500 to-amber-500" },
  { value: "THIS_WEEKEND", label: "This Weekend", sublabel: "Sat or Sun", icon: CalendarDays, color: "from-blue-500 to-cyan-500" },
  { value: "FLEXIBLE", label: "Flexible", sublabel: "No rush", icon: Calendar, color: "from-emerald-500 to-teal-500" }
];

// ============================================
// ADDITIONAL OPTIONS
// ============================================

export const TOOL_CATEGORIES = [
  "Diagnostics",
  "Lifting Equipment", 
  "Power Tools",
  "Hand Tools",
  "Welding",
  "Air Tools",
  "Specialist Tools",
  "Other"
];

export const TOOL_CONDITIONS: ToolConditionOption[] = [
  { value: "NEW", label: "New", description: "Brand new, unused" },
  { value: "LIKE_NEW", label: "Like New", description: "Barely used" },
  { value: "GOOD", label: "Good", description: "Normal wear" },
  { value: "FAIR", label: "Fair", description: "Works well" },
  { value: "POOR", label: "Poor", description: "Heavy wear" }
];

export const SPACE_FEATURES = [
  // Lifting & Access
  "2-Post Lift",
  "4-Post Lift",
  "Scissor Lift",
  "Inspection Pit",
  "Engine Crane",
  // Workshop Equipment
  "Parts Washer",
  "Bench Vice",
  "Workbench",
  "Air Compressor",
  "Welding Bay",
  "Tyre Changer",
  "Wheel Balancer",
  "Brake Lathe",
  "Oil Drain",
  "Extraction Fan",
  "Pressure Washer",
  // Utilities & Amenities
  "3-Phase Power",
  "Power Supply",
  "Good Lighting",
  "Heating",
  "WiFi",
  "Water Supply",
  "Toilet",
  "Parking",
  "Tool Storage",
  "Waiting Area",
  "24/7 Access"
];

export const SERVICE_SPECIALTIES = [
  "General Repairs",
  "Diagnostics",
  "Electrical",
  "Engine Work",
  "Gearbox",
  "Brakes",
  "Suspension",
  "Air Con",
  "MOT Prep",
  "Welding",
  "ECU Tuning",
  "Classic Cars",
  "Performance",
  "Commercial"
];

// ============================================
// ANIMATION VARIANTS
// ============================================

export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
  }
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { type: "spring", damping: 20, stiffness: 300 } 
  }
};

export const pageTransition: Variants = {
  initial: { opacity: 0, x: 40, scale: 0.98 },
  animate: { 
    opacity: 1, 
    x: 0, 
    scale: 1,
    transition: { type: "spring", damping: 25, stiffness: 300 } 
  },
  exit: { opacity: 0, x: -40, scale: 0.98, transition: { duration: 0.2 } }
};
