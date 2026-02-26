/**
 * AISuggestionPreview - Modal to preview and accept AI suggestions
 *
 * Shows generated listing content with options to:
 * - Accept all suggestions
 * - Accept individual fields
 * - Edit before accepting
 * - Reject and close
 */

import { useState, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GeneratedListing } from '@/api/services/ai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sparkles,
  Check,
  X,
  Edit3,
  PoundSterling,
  Tag,
  FileText,
  ListChecks,
  CheckCircle2,
  ArrowRight,
  Camera,
  AlertTriangle
} from 'lucide-react';

interface AISuggestionPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: GeneratedListing | null;
  listingType: 'tool' | 'space' | 'service';
  onAccept: (accepted: Partial<GeneratedListing>) => void;
}

interface FieldState {
  accepted: boolean;
  editing: boolean;
  value: string | string[] | number;
}

export function AISuggestionPreview({
  isOpen,
  onClose,
  suggestions,
  listingType,
  onAccept
}: AISuggestionPreviewProps) {
  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>({});

  if (!suggestions) return null;

  // Initialize field states
  const getFieldState = (key: string, defaultValue: string | string[] | number): FieldState => {
    return fieldStates[key] || { accepted: false, editing: false, value: defaultValue };
  };

  const toggleAccept = (key: string, value: string | string[] | number) => {
    setFieldStates(prev => ({
      ...prev,
      [key]: {
        ...getFieldState(key, value),
        accepted: !getFieldState(key, value).accepted,
        editing: false
      }
    }));
  };

  const startEditing = (key: string, value: string | string[] | number) => {
    setFieldStates(prev => ({
      ...prev,
      [key]: { ...getFieldState(key, value), editing: true, value }
    }));
  };

  const updateValue = (key: string, newValue: string | string[] | number) => {
    setFieldStates(prev => ({
      ...prev,
      [key]: { ...prev[key], value: newValue }
    }));
  };

  const confirmEdit = (key: string) => {
    setFieldStates(prev => ({
      ...prev,
      [key]: { ...prev[key], editing: false, accepted: true }
    }));
  };

  const acceptAll = () => {
    const allAccepted: Partial<GeneratedListing> = {
      title: fieldStates.title?.value as string || suggestions.title,
      description: fieldStates.description?.value as string || suggestions.description,
      category: fieldStates.category?.value as string || suggestions.category,
      features: fieldStates.features?.value as string[] || suggestions.features,
      suggestedDailyRate: fieldStates.suggestedDailyRate?.value as number || suggestions.suggestedDailyRate,
      suggestedDeposit: fieldStates.suggestedDeposit?.value as number || suggestions.suggestedDeposit,
      condition: suggestions.condition,
      keywords: suggestions.keywords
    };
    onAccept(allAccepted);
    onClose();
  };


  const formatPrice = (pence: number) => (pence / 100).toFixed(0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            AI Generated Listing
          </DialogTitle>
          <DialogDescription>
            Review the AI suggestions below. Click on any field to accept or edit it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Image Analysis Results (when photos were analyzed) */}
          {suggestions.imageAnalysis && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 overflow-hidden"
            >
              <div className="px-4 py-3 bg-purple-100/50 flex items-center gap-2">
                <Camera className="w-4 h-4 text-purple-600" />
                <span className="font-medium text-sm text-purple-900">Photo Analysis Results</span>
                {suggestions.imageAnalysis.confidence && (
                  <Badge variant="outline" className="text-xs bg-white">
                    {Math.round(suggestions.imageAnalysis.confidence * 100)}% confident
                  </Badge>
                )}
              </div>
              <div className="p-4 space-y-3">
                {/* Detected Item Type */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-purple-600 font-medium min-w-[80px]">Detected:</span>
                  <span className="text-gray-800">{suggestions.imageAnalysis.itemType}</span>
                </div>

                {/* Brand & Model */}
                {(suggestions.imageAnalysis.brand || suggestions.imageAnalysis.model) && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-purple-600 font-medium min-w-[80px]">Brand/Model:</span>
                    <span className="text-gray-800">
                      {[suggestions.imageAnalysis.brand, suggestions.imageAnalysis.model]
                        .filter(Boolean)
                        .join(' ')}
                    </span>
                  </div>
                )}

                {/* Condition from Photos */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-purple-600 font-medium min-w-[80px]">Condition:</span>
                  <Badge className={
                    suggestions.imageAnalysis.condition === 'NEW' ? 'bg-green-600' :
                    suggestions.imageAnalysis.condition === 'LIKE_NEW' ? 'bg-green-500' :
                    suggestions.imageAnalysis.condition === 'GOOD' ? 'bg-blue-500' :
                    suggestions.imageAnalysis.condition === 'FAIR' ? 'bg-yellow-500' :
                    'bg-orange-500'
                  }>
                    {suggestions.imageAnalysis.condition.replace('_', ' ')}
                  </Badge>
                  <span className="text-xs text-gray-500">(from photo inspection)</span>
                </div>

                {/* Photo Features */}
                {suggestions.imageAnalysis.features.length > 0 && (
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-purple-600 font-medium min-w-[80px]">Visible:</span>
                    <div className="flex flex-wrap gap-1">
                      {suggestions.imageAnalysis.features.slice(0, 5).map((feature, i) => (
                        <Badge key={i} variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Concerns/Issues */}
                {suggestions.imageAnalysis.concerns.length > 0 && (
                  <div className="flex items-start gap-2 text-sm mt-2 p-2 bg-yellow-50 rounded-md border border-yellow-200">
                    <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-yellow-800 font-medium">Noted from photos:</span>
                      <ul className="mt-1 space-y-1">
                        {suggestions.imageAnalysis.concerns.map((concern, i) => (
                          <li key={i} className="text-yellow-700 text-xs">• {concern}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Title */}
          <SuggestionField
            label="Title"
            icon={<FileText className="w-4 h-4" />}
            value={suggestions.title}
            fieldState={getFieldState('title', suggestions.title)}
            onToggleAccept={() => toggleAccept('title', suggestions.title)}
            onStartEdit={() => startEditing('title', suggestions.title)}
            onUpdateValue={(v) => updateValue('title', v)}
            onConfirmEdit={() => confirmEdit('title')}
            inputType="text"
          />

          {/* Description */}
          <SuggestionField
            label="Description"
            icon={<FileText className="w-4 h-4" />}
            value={suggestions.description}
            fieldState={getFieldState('description', suggestions.description)}
            onToggleAccept={() => toggleAccept('description', suggestions.description)}
            onStartEdit={() => startEditing('description', suggestions.description)}
            onUpdateValue={(v) => updateValue('description', v)}
            onConfirmEdit={() => confirmEdit('description')}
            inputType="textarea"
          />

          {/* Category */}
          <SuggestionField
            label="Category"
            icon={<Tag className="w-4 h-4" />}
            value={suggestions.category}
            fieldState={getFieldState('category', suggestions.category)}
            onToggleAccept={() => toggleAccept('category', suggestions.category)}
            onStartEdit={() => startEditing('category', suggestions.category)}
            onUpdateValue={(v) => updateValue('category', v)}
            onConfirmEdit={() => confirmEdit('category')}
            inputType="text"
          />

          {/* Features */}
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-sm">Features</span>
              </div>
              <Button
                type="button"
                size="sm"
                variant={getFieldState('features', suggestions.features).accepted ? 'default' : 'outline'}
                className={getFieldState('features', suggestions.features).accepted ? 'bg-green-600 hover:bg-green-700' : ''}
                onClick={() => toggleAccept('features', suggestions.features)}
              >
                {getFieldState('features', suggestions.features).accepted ? (
                  <><CheckCircle2 className="w-4 h-4 mr-1" /> Accepted</>
                ) : (
                  <><Check className="w-4 h-4 mr-1" /> Accept</>
                )}
              </Button>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                {suggestions.features.map((feature, i) => (
                  <Badge key={i} variant="secondary" className="bg-purple-100 text-purple-700">
                    {feature}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-4">
            <SuggestionField
              label={listingType === 'service' ? 'Hourly Rate' : 'Daily Rate'}
              icon={<PoundSterling className="w-4 h-4" />}
              value={`£${formatPrice(suggestions.suggestedDailyRate)}`}
              fieldState={getFieldState('suggestedDailyRate', suggestions.suggestedDailyRate)}
              onToggleAccept={() => toggleAccept('suggestedDailyRate', suggestions.suggestedDailyRate)}
              onStartEdit={() => startEditing('suggestedDailyRate', suggestions.suggestedDailyRate)}
              onUpdateValue={(v) => updateValue('suggestedDailyRate', parseInt(v as string) * 100)}
              onConfirmEdit={() => confirmEdit('suggestedDailyRate')}
              inputType="number"
              displayValue={`£${formatPrice(suggestions.suggestedDailyRate)}`}
            />

            {listingType === 'tool' && (
              <SuggestionField
                label="Deposit"
                icon={<PoundSterling className="w-4 h-4" />}
                value={`£${formatPrice(suggestions.suggestedDeposit)}`}
                fieldState={getFieldState('suggestedDeposit', suggestions.suggestedDeposit)}
                onToggleAccept={() => toggleAccept('suggestedDeposit', suggestions.suggestedDeposit)}
                onStartEdit={() => startEditing('suggestedDeposit', suggestions.suggestedDeposit)}
                onUpdateValue={(v) => updateValue('suggestedDeposit', parseInt(v as string) * 100)}
                onConfirmEdit={() => confirmEdit('suggestedDeposit')}
                inputType="number"
                displayValue={`£${formatPrice(suggestions.suggestedDeposit)}`}
              />
            )}
          </div>

          {/* Condition (tools only) */}
          {suggestions.condition && (
            <SuggestionField
              label="Condition"
              icon={<Tag className="w-4 h-4" />}
              value={suggestions.condition}
              fieldState={getFieldState('condition', suggestions.condition || '')}
              onToggleAccept={() => toggleAccept('condition', suggestions.condition || '')}
              onStartEdit={() => startEditing('condition', suggestions.condition || '')}
              onUpdateValue={(v) => updateValue('condition', v)}
              onConfirmEdit={() => confirmEdit('condition')}
              inputType="text"
            />
          )}

          {/* Keywords */}
          {suggestions.keywords.length > 0 && (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 flex items-center gap-2">
                <Tag className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-sm">SEO Keywords</span>
                <span className="text-xs text-gray-400">(auto-applied)</span>
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {suggestions.keywords.map((keyword, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            type="button"
            onClick={acceptAll}
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
          >
            <Check className="w-4 h-4 mr-2" />
            Accept All
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper component for each suggestion field
interface SuggestionFieldProps {
  label: string;
  icon: React.ReactNode;
  value: string | number;
  displayValue?: string;
  fieldState: FieldState;
  onToggleAccept: () => void;
  onStartEdit: () => void;
  onUpdateValue: (value: string) => void;
  onConfirmEdit: () => void;
  inputType: 'text' | 'textarea' | 'number';
}

function SuggestionField({
  label,
  icon,
  value,
  displayValue,
  fieldState,
  onToggleAccept,
  onStartEdit,
  onUpdateValue,
  onConfirmEdit,
  inputType
}: SuggestionFieldProps) {
  return (
    <motion.div
      className={`rounded-lg border overflow-hidden transition-colors ${
        fieldState.accepted ? 'border-green-300 bg-green-50/50' : 'border-gray-200'
      }`}
      layout
    >
      <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{icon}</span>
          <span className="font-medium text-sm">{label}</span>
          {fieldState.accepted && (
            <Badge className="bg-green-600 text-white text-xs">Accepted</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!fieldState.editing && (
            <>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onStartEdit}
                className="h-7 px-2"
              >
                <Edit3 className="w-3 h-3" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant={fieldState.accepted ? 'default' : 'outline'}
                className={`h-7 ${fieldState.accepted ? 'bg-green-600 hover:bg-green-700' : ''}`}
                onClick={onToggleAccept}
              >
                <Check className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="p-4">
        <AnimatePresence mode="wait">
          {fieldState.editing ? (
            <motion.div
              key="editing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {inputType === 'textarea' ? (
                <Textarea
                  value={fieldState.value as string}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onUpdateValue(e.target.value)}
                  className="min-h-[100px]"
                />
              ) : (
                <Input
                  type={inputType}
                  value={inputType === 'number' ? (fieldState.value as number) / 100 : fieldState.value as string}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdateValue(e.target.value)}
                />
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => onToggleAccept()}>
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={onConfirmEdit}>
                  <Check className="w-3 h-3 mr-1" /> Save
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.p
              key="display"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`text-sm ${inputType === 'textarea' ? 'whitespace-pre-wrap' : ''} ${
                fieldState.accepted ? 'text-green-800' : 'text-gray-700'
              }`}
            >
              {displayValue || value}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
