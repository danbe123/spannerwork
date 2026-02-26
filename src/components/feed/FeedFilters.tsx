import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, CreditCard, PoundSterling, Globe, Zap, CalendarDays, Calendar, X, Check, RefreshCw } from "lucide-react";
import { ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface FeedFiltersProps {
  urgencyFilter: string;
  setUrgencyFilter: (value: string) => void;
  rateTypeFilter: string;
  setRateTypeFilter: (value: string) => void;
  budgetRange: number | string;
  setBudgetRange: (value: number | string) => void;
  radiusFilter: number;
  setRadiusFilter: (value: number) => void;
  nationwideSearch: boolean;
  setNationwideSearch: (value: boolean) => void;
  onClose?: () => void;
  onReset?: () => void;
  isMobile?: boolean;
}

// Filter card wrapper component
function FilterCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-gray-50/80 rounded-xl p-4 border border-gray-100 ${className}`}>
      {children}
    </div>
  );
}

// Active filter pill component
function ActiveFilterPill({
  label,
  icon: Icon,
  color,
  onRemove
}: {
  label: string;
  icon: React.ElementType;
  color: string;
  onRemove: () => void;
}) {
  const colorClasses: Record<string, string> = {
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    orange: "bg-brand-50 text-brand-700 border-brand-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${colorClasses[color]}`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
      <button
        onClick={onRemove}
        className="ml-1 p-0.5 rounded-full hover:bg-black/10 transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <X className="w-3 h-3" />
      </button>
    </motion.div>
  );
}

export default function FeedFilters({
  urgencyFilter,
  setUrgencyFilter,
  rateTypeFilter,
  setRateTypeFilter,
  budgetRange,
  setBudgetRange,
  radiusFilter,
  setRadiusFilter,
  nationwideSearch,
  setNationwideSearch,
  onClose,
  onReset,
  isMobile = false,
}: FeedFiltersProps) {
  const handleBudgetChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBudgetRange(value ? parseFloat(value) : '');
  };

  // Check if any filters are active
  const hasActiveFilters =
    nationwideSearch ||
    (!nationwideSearch && radiusFilter < 25) ||
    urgencyFilter !== 'all' ||
    rateTypeFilter !== 'all' ||
    Boolean(budgetRange);

  // Count active filters
  const activeFilterCount = [
    nationwideSearch || (!nationwideSearch && radiusFilter < 25),
    urgencyFilter !== 'all',
    rateTypeFilter !== 'all',
    Boolean(budgetRange),
  ].filter(Boolean).length;

  // Get distance label
  const getDistanceLabel = () => {
    if (nationwideSearch) return "Nationwide";
    if (radiusFilter <= 5) return "Walking distance";
    if (radiusFilter <= 15) return "Short drive";
    if (radiusFilter <= 50) return "Local area";
    if (radiusFilter <= 100) return "Regional";
    return "Wide area";
  };

  // Mobile Layout - Compact version that fits on screen
  if (isMobile) {
    return (
      <div className="flex flex-col">
        {/* Filter content - compact layout */}
        <div className="px-4 py-3 space-y-4">

          {/* Location - Compact */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-gray-700">Location</span>
            </div>
            <div className="flex items-center gap-3">
              {!nationwideSearch && (
                <span className="text-sm font-semibold text-gray-900">{radiusFilter} mi</span>
              )}
              <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1.5">
                <span className="text-xs text-gray-600">UK</span>
                <Switch
                  checked={nationwideSearch}
                  onCheckedChange={setNationwideSearch}
                  className="data-[state=checked]:bg-purple-600 scale-90"
                />
              </div>
            </div>
          </div>

          {/* Radius Slider - only show if not nationwide */}
          {!nationwideSearch && (
            <div className="px-1">
              <Slider
                value={[radiusFilter]}
                onValueChange={(value) => setRadiusFilter(value[0])}
                min={1}
                max={150}
                step={5}
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1 mi</span>
                <span className="text-purple-600 font-medium">{getDistanceLabel()}</span>
                <span>150 mi</span>
              </div>
            </div>
          )}

          {/* Urgency - Horizontal scroll */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-brand-500" />
              <span className="text-sm font-medium text-gray-700">Urgency</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
              {[
                { value: 'all', label: 'All', color: 'gray' },
                { value: 'asap', label: 'ASAP', icon: Zap, color: 'red' },
                { value: 'today', label: 'Today', icon: Clock, color: 'orange' },
                { value: 'this_weekend', label: 'Weekend', icon: CalendarDays, color: 'blue' },
                { value: 'flexible', label: 'Flexible', icon: Calendar, color: 'green' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setUrgencyFilter(opt.value)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium border transition-all ${
                    urgencyFilter === opt.value
                      ? opt.color === 'red' ? 'bg-red-500 text-white border-red-500'
                        : opt.color === 'orange' ? 'bg-brand-500 text-white border-brand-500'
                        : opt.color === 'blue' ? 'bg-blue-500 text-white border-blue-500'
                        : opt.color === 'green' ? 'bg-green-500 text-white border-green-500'
                        : 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 border-gray-200'
                  }`}
                >
                  {opt.icon && <opt.icon className="w-3.5 h-3.5" />}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Type - Horizontal scroll */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-700">Payment</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
              {[
                { value: 'all', label: 'All types' },
                { value: 'hourly', label: 'Hourly' },
                { value: 'daily', label: 'Daily' },
                { value: 'fixed', label: 'Fixed' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRateTypeFilter(opt.value)}
                  className={`flex-shrink-0 px-3 py-2 rounded-full text-sm font-medium border transition-all ${
                    rateTypeFilter === opt.value
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Budget - Quick select buttons */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <PoundSterling className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-gray-700">Max Budget</span>
              {budgetRange && (
                <span className="text-sm font-semibold text-green-600">£{budgetRange}</span>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
              {[
                { value: '', label: 'Any' },
                { value: 50, label: '£50' },
                { value: 100, label: '£100' },
                { value: 250, label: '£250' },
                { value: 500, label: '£500' },
                { value: 1000, label: '£1000' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setBudgetRange(opt.value)}
                  className={`flex-shrink-0 px-3 py-2 rounded-full text-sm font-medium border transition-all ${
                    (budgetRange === opt.value) || (!budgetRange && opt.value === '')
                      ? 'bg-green-500 text-white border-green-500'
                      : 'bg-white text-gray-700 border-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="border-t border-gray-200 bg-white px-4 py-3">
          <div className="flex gap-3">
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={onReset}
                className="px-4"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Reset
              </Button>
            )}
            <Button
              onClick={onClose}
              size="sm"
              className="flex-1 bg-brand-500 hover:bg-brand-600"
            >
              <Check className="w-4 h-4 mr-1" />
              Apply Filters
              {activeFilterCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-white/20 rounded-full text-xs">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className="space-y-4">
      {/* Filter Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">

        {/* Location Filter */}
        <FilterCard className="sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-purple-600" />
              Location
            </Label>
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-gray-400" />
              <Switch
                checked={nationwideSearch}
                onCheckedChange={setNationwideSearch}
                className="data-[state=checked]:bg-purple-600"
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {nationwideSearch ? (
              <motion.div
                key="nationwide"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center py-3"
              >
                <p className="text-sm font-medium text-gray-700">Searching nationwide</p>
                <p className="text-xs text-gray-500">All UK jobs visible</p>
              </motion.div>
            ) : (
              <motion.div
                key="radius"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-2xl font-bold text-gray-900">{radiusFilter}</span>
                  <span className="text-sm text-gray-500">miles</span>
                </div>
                <Slider
                  value={[radiusFilter]}
                  onValueChange={(value) => setRadiusFilter(value[0])}
                  min={1}
                  max={150}
                  step={5}
                  className="mb-2"
                />
                <p className="text-xs text-gray-500 text-center">{getDistanceLabel()}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </FilterCard>

        {/* Urgency Filter */}
        <FilterCard>
          <Label className="text-sm font-medium text-gray-900 flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-brand-500" />
            Urgency
          </Label>
          <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
            <SelectTrigger className="bg-white border-gray-200 focus:ring-brand-500">
              <SelectValue placeholder="Any urgency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="flex items-center gap-2">All urgencies</span>
              </SelectItem>
              <SelectItem value="asap">
                <span className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-red-500" /> ASAP
                </span>
              </SelectItem>
              <SelectItem value="today">
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-500" /> Today
                </span>
              </SelectItem>
              <SelectItem value="this_weekend">
                <span className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-blue-500" /> This Weekend
                </span>
              </SelectItem>
              <SelectItem value="flexible">
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-green-500" /> Flexible
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </FilterCard>

        {/* Payment Type Filter */}
        <FilterCard>
          <Label className="text-sm font-medium text-gray-900 flex items-center gap-2 mb-3">
            <CreditCard className="w-4 h-4 text-blue-500" />
            Payment
          </Label>
          <Select value={rateTypeFilter} onValueChange={setRateTypeFilter}>
            <SelectTrigger className="bg-white border-gray-200 focus:ring-blue-500">
              <SelectValue placeholder="Any type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="hourly">Hourly rate</SelectItem>
              <SelectItem value="daily">Daily rate</SelectItem>
              <SelectItem value="fixed">Fixed price</SelectItem>
            </SelectContent>
          </Select>
        </FilterCard>

        {/* Budget Filter */}
        <FilterCard>
          <Label className="text-sm font-medium text-gray-900 flex items-center gap-2 mb-3">
            <PoundSterling className="w-4 h-4 text-green-600" />
            Max Budget
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">£</span>
            <Input
              type="number"
              min="0"
              step="10"
              value={budgetRange || ''}
              onChange={handleBudgetChange}
              placeholder="No limit"
              className="pl-7 bg-white border-gray-200 focus:ring-green-500"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">Leave empty for all budgets</p>
        </FilterCard>
      </div>

      {/* Active Filters */}
      <AnimatePresence>
        {hasActiveFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 flex-wrap pt-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active:</span>

              <AnimatePresence mode="popLayout">
                {nationwideSearch && (
                  <ActiveFilterPill
                    key="nationwide"
                    label="Nationwide"
                    icon={Globe}
                    color="purple"
                    onRemove={() => setNationwideSearch(false)}
                  />
                )}

                {!nationwideSearch && radiusFilter < 25 && (
                  <ActiveFilterPill
                    key="radius"
                    label={`Within ${radiusFilter} mi`}
                    icon={MapPin}
                    color="purple"
                    onRemove={() => setRadiusFilter(25)}
                  />
                )}

                {urgencyFilter !== 'all' && (
                  <ActiveFilterPill
                    key="urgency"
                    label={urgencyFilter === 'this_weekend' ? 'Weekend' : urgencyFilter.charAt(0).toUpperCase() + urgencyFilter.slice(1)}
                    icon={Clock}
                    color="orange"
                    onRemove={() => setUrgencyFilter('all')}
                  />
                )}

                {rateTypeFilter !== 'all' && (
                  <ActiveFilterPill
                    key="ratetype"
                    label={rateTypeFilter.charAt(0).toUpperCase() + rateTypeFilter.slice(1)}
                    icon={CreditCard}
                    color="blue"
                    onRemove={() => setRateTypeFilter('all')}
                  />
                )}

                {budgetRange && (
                  <ActiveFilterPill
                    key="budget"
                    label={`Max £${budgetRange}`}
                    icon={PoundSterling}
                    color="green"
                    onRemove={() => setBudgetRange('')}
                  />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
