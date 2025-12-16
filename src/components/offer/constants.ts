/**
 * Constants and configuration for offer creation forms
 */

export const AVAILABLE_FEATURES: string[] = [
  "Vehicle Ramp",
  "Inspection Pit",
  "Vehicle Lift",
  "Air Compressor",
  "Tire Changer",
  "Wheel Balancer",
  "Diagnostic Equipment",
  "Welding Station",
  "Parts Washer",
  "Tool Storage",
  "Climate Controlled",
  "24/7 Access",
  "Security System",
  "Lighting",
  "Water Access"
];

export const SERVICE_SPECIALTIES: string[] = [
  "Classic Cars",
  "Classic British Cars",
  "Land Rover Specialist",
  "Jaguar Specialist",
  "Mini Specialist",
  "MG & Triumph",
  "Vintage Restoration",
  "Performance Tuning",
  "Engine Remapping",
  "Track Day Prep",
  "American Muscle",
  "Modified Cars",
  "Custom Fabrication",
  "Electric Vehicles",
  "EV Battery Diagnostics",
  "EV Charging Systems",
  "Hybrid Systems",
  "Tesla Specialist",
  "Nissan Leaf Specialist",
  "MIG Welding",
  "TIG Welding",
  "Arc Welding",
  "Aluminum Welding",
  "Stainless Steel Welding",
  "Exhaust Fabrication",
  "Roll Cage Fabrication",
  "Chassis Repairs",
  "German Cars (VW/Audi/BMW)",
  "French Cars (Peugeot/Citroën)",
  "Diesel Engines",
  "Petrol Engines",
  "Turbocharged Engines",
  "Rotary Engines",
  "Motorcycles",
  "Commercial Vehicles",
  "Light Commercial Vans",
  "HGV & Lorries",
  "Caravans & Motorhomes",
  "Agricultural Vehicles",
  "Plant Machinery",
  "MOT Preparation",
  "Emissions & DPF",
  "Air Conditioning",
  "Auto Electrical",
  "ECU Programming",
  "Key Programming",
  "Paint Correction",
  "Ceramic Coating",
  "PPF Installation",
  "Dent Removal (PDR)",
  "Rust Repairs",
  "Panel Beating",
  "Engine Rebuilds",
  "Gearbox Rebuilds",
  "Turbo Repairs",
  "Timing Belt Specialist",
  "Head Gasket Repairs",
  "Suspension Tuning",
  "Coilover Installation",
  "Brake Upgrades",
  "4x4 & Off-Road",
  "Mobile Mechanic",
  "Roadside Assistance",
  "Pre-Purchase Inspections",
  "Fleet Maintenance"
];

export const TOOL_CATEGORIES: string[] = [
  "Hand Tools",
  "Power Tools",
  "Automotive",
  "Lifting Equipment",
  "Diagnostic Tools",
  "Welding",
  "Woodworking",
  "Painting",
  "Specialty Tools",
  "Other"
];

export interface SelectOption {
  value: string;
  label: string;
}

export const TOOL_CONDITIONS: SelectOption[] = [
  { value: "excellent", label: "Excellent - Like New" },
  { value: "good", label: "Good - Well Maintained" },
  { value: "fair", label: "Fair - Some Wear" }
];

export const LENDING_TYPES: SelectOption[] = [
  { value: "hourly", label: "Hourly Rate" },
  { value: "daily", label: "Daily Rate" },
  { value: "rental", label: "Both Hourly & Daily" },
  { value: "recurring", label: "Recurring Rental (Weekly/Monthly)" }
];

export const PRICING_TYPES: SelectOption[] = [
  { value: "hourly", label: "Hourly Rate" },
  { value: "fixed", label: "Fixed Price per Job" },
  { value: "quote", label: "Quote on Request" }
];

export interface InitialToolData {
  name: string;
  category: string;
  description: string;
  condition: string;
  lending_type: string;
  hourly_rate: number;
  daily_rate: number;
  weekly_rate: number;
  monthly_rate: number;
  deposit_amount: number;
  insurance_available: boolean;
  insurance_cost: number;
  tool_value: number;
  requires_supervision: boolean;
  can_teach: boolean;
  teaching_rate: number;
  allow_calendar_booking: boolean;
}

export const INITIAL_TOOL_DATA: InitialToolData = {
  name: "",
  category: "Power Tools",
  description: "",
  condition: "good",
  lending_type: "rental",
  hourly_rate: 0,
  daily_rate: 0,
  weekly_rate: 0,
  monthly_rate: 0,
  deposit_amount: 0,
  insurance_available: false,
  insurance_cost: 0,
  tool_value: 0,
  requires_supervision: false,
  can_teach: false,
  teaching_rate: 0,
  allow_calendar_booking: true,
};

export interface InitialSpaceData {
  name: string;
  space_type: string;
  description: string;
  size_sqft: number;
  max_vehicle_height: number;
  vehicle_capacity: number;
  hourly_rate: number;
  daily_rate: number;
  weekly_rate: number;
  monthly_rate: number;
  deposit_amount: number;
  electricity_available: boolean;
  tools_available: boolean;
  supervision_required: boolean;
  insurance_required: boolean;
}

export const INITIAL_SPACE_DATA: InitialSpaceData = {
  name: "",
  space_type: "garage",
  description: "",
  size_sqft: 0,
  max_vehicle_height: 0,
  vehicle_capacity: 1,
  hourly_rate: 0,
  daily_rate: 0,
  weekly_rate: 0,
  monthly_rate: 0,
  deposit_amount: 0,
  electricity_available: true,
  tools_available: false,
  supervision_required: false,
  insurance_required: false,
};

export interface InitialServiceData {
  title: string;
  category: string;
  description: string;
  pricing_type: string;
  hourly_rate: number;
  fixed_rate: number;
  mobile_service: boolean;
  service_radius: number;
  callout_fee: number;
  experience_years: number;
  response_time: string;
  min_job_value: number;
  has_insurance: boolean;
  insurance_amount: number;
  weekend_availability: boolean;
  evening_availability: boolean;
  emergency_callout: boolean;
  offers_free_quote: boolean;
}

export const INITIAL_SERVICE_DATA: InitialServiceData = {
  title: "",
  category: "Mechanical Repair",
  description: "",
  pricing_type: "hourly",
  hourly_rate: 0,
  fixed_rate: 0,
  mobile_service: false,
  service_radius: 10,
  callout_fee: 0,
  experience_years: 0,
  response_time: "flexible",
  min_job_value: 0,
  has_insurance: false,
  insurance_amount: 0,
  weekend_availability: false,
  evening_availability: false,
  emergency_callout: false,
  offers_free_quote: true,
};
