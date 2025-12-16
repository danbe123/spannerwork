import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";
import { ChangeEvent } from "react";

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
  setNationwideSearch
}: FeedFiltersProps) {
  const handleBudgetChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBudgetRange(value ? parseFloat(value) : '');
  };

  return (
    <div className="mt-4 pt-4 border-t">
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Location Radius Filter */}
        <div className="md:col-span-2 lg:col-span-1">
          <Label className="text-sm text-gray-600 mb-2 block flex items-center gap-2">
            <MapPin className="w-4 h-4 text-brand-800" />
            Distance: {nationwideSearch ? 'Nationwide' : `${radiusFilter} miles`}
          </Label>
          {!nationwideSearch && (
            <>
              <Slider
                value={[radiusFilter]}
                onValueChange={(value) => setRadiusFilter(value[0])}
                min={1}
                max={150}
                step={5}
                className="mt-2"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1 mi</span>
                <span>150 mi</span>
              </div>
            </>
          )}
          <div className="flex items-center gap-2 mt-3">
            <Checkbox
              id="nationwide"
              checked={nationwideSearch}
              onCheckedChange={(checked) => setNationwideSearch(checked as boolean)}
            />
            <Label htmlFor="nationwide" className="text-sm text-gray-700 cursor-pointer">
              Search nationwide
            </Label>
          </div>
          {!nationwideSearch && (
            <p className="text-xs text-gray-500 mt-2">
              {radiusFilter <= 5 && "Very close - walking distance"}
              {radiusFilter > 5 && radiusFilter <= 15 && "Short drive"}
              {radiusFilter > 15 && radiusFilter <= 50 && "Reasonable distance"}
              {radiusFilter > 50 && radiusFilter <= 100 && "Regional search"}
              {radiusFilter > 100 && "Wide area search"}
            </p>
          )}
        </div>

        {/* Urgency Filter */}
        <div>
          <Label className="text-sm text-gray-600 mb-2 block">Urgency</Label>
          <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Any urgency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Urgency</SelectItem>
              <SelectItem value="asap">⚡ ASAP</SelectItem>
              <SelectItem value="today">🔥 Today</SelectItem>
              <SelectItem value="this_weekend">📅 This Weekend</SelectItem>
              <SelectItem value="flexible">🕐 Flexible</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Rate Type Filter */}
        <div>
          <Label className="text-sm text-gray-600 mb-2 block">Payment Type</Label>
          <Select value={rateTypeFilter} onValueChange={setRateTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Any payment type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="hourly">💰 Hourly Rate</SelectItem>
              <SelectItem value="daily">📆 Daily Rate</SelectItem>
              <SelectItem value="fixed">💵 Fixed Price</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Budget Range Filter */}
        <div>
          <Label className="text-sm text-gray-600 mb-2 block">
            Max Budget
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">£</span>
            <Input
              type="number"
              min="0"
              step="10"
              value={budgetRange || ''}
              onChange={handleBudgetChange}
              placeholder="Any budget"
              className="pl-8"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Leave empty for no limit</p>
        </div>
      </div>

      {/* Active Filters Summary */}
      <div className="mt-4 flex flex-wrap gap-2">
        {nationwideSearch && (
          <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
            <MapPin className="w-3 h-3" />
            <span>Nationwide search</span>
            <button onClick={() => setNationwideSearch(false)} className="hover:text-purple-900">✕</button>
          </div>
        )}
        {!nationwideSearch && radiusFilter < 10 && (
          <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
            <MapPin className="w-3 h-3" />
            <span>Within {radiusFilter} miles</span>
            <button onClick={() => setRadiusFilter(10)} className="hover:text-purple-900">✕</button>
          </div>
        )}
        {urgencyFilter !== 'all' && (
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm">
            <span>Urgency: {urgencyFilter.replace('_', ' ')}</span>
            <button onClick={() => setUrgencyFilter('all')} className="hover:text-orange-900">✕</button>
          </div>
        )}
        {rateTypeFilter !== 'all' && (
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
            <span>Payment: {rateTypeFilter}</span>
            <button onClick={() => setRateTypeFilter('all')} className="hover:text-blue-900">✕</button>
          </div>
        )}
        {budgetRange && (
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
            <span>Max budget: £{budgetRange}</span>
            <button onClick={() => setBudgetRange('')} className="hover:text-green-900">✕</button>
          </div>
        )}
      </div>
    </div>
  );
}
