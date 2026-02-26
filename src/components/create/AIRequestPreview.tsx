/**
 * AIRequestPreview - Modal to preview and accept AI-generated job request
 *
 * Shows generated request content with options to:
 * - Accept all suggestions
 * - Accept individual fields
 * - Edit before accepting
 * - Reject and close
 */

import { useState, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GeneratedRequest } from '@/api/services/ai';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sparkles,
  Check,
  X,
  Edit3,
  PoundSterling,
  Tag,
  FileText,
  Clock,
  Zap,
  ArrowRight
} from 'lucide-react';

interface AIRequestPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: GeneratedRequest | null;
  category: 'TOOLS' | 'EXPERTISE' | 'SPACE';
  onAccept: (accepted: Partial<GeneratedRequest>) => void;
}

interface FieldState {
  accepted: boolean;
  editing: boolean;
  value: string | number;
}

const URGENCY_LABELS: Record<string, { label: string; description: string }> = {
  ASAP: { label: 'ASAP', description: 'Within hours' },
  TODAY: { label: 'Today', description: 'By end of day' },
  THIS_WEEKEND: { label: 'This Weekend', description: 'Saturday or Sunday' },
  FLEXIBLE: { label: 'Flexible', description: 'No rush' },
};

const RATE_TYPE_LABELS: Record<string, string> = {
  FIXED: 'Fixed Price',
  HOURLY: 'Per Hour',
  DAILY: 'Per Day',
};

export function AIRequestPreview({
  isOpen,
  onClose,
  suggestions,
  category,
  onAccept
}: AIRequestPreviewProps) {
  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>({});

  if (!suggestions) return null;

  const getFieldState = (key: string, defaultValue: string | number): FieldState => {
    return fieldStates[key] || { accepted: false, editing: false, value: defaultValue };
  };

  const toggleAccept = (key: string, value: string | number) => {
    setFieldStates(prev => ({
      ...prev,
      [key]: {
        ...getFieldState(key, value),
        accepted: !getFieldState(key, value).accepted,
        editing: false
      }
    }));
  };

  const startEditing = (key: string, value: string | number) => {
    setFieldStates(prev => ({
      ...prev,
      [key]: { ...getFieldState(key, value), editing: true, value }
    }));
  };

  const updateValue = (key: string, newValue: string | number) => {
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
    const allAccepted: Partial<GeneratedRequest> = {
      title: fieldStates.title?.value as string || suggestions.title,
      description: fieldStates.description?.value as string || suggestions.description,
      suggestedBudget: fieldStates.suggestedBudget?.value as number || suggestions.suggestedBudget,
      suggestedRateType: (fieldStates.suggestedRateType?.value as 'FIXED' | 'HOURLY' | 'DAILY') || suggestions.suggestedRateType,
      suggestedUrgency: (fieldStates.suggestedUrgency?.value as 'ASAP' | 'TODAY' | 'THIS_WEEKEND' | 'FLEXIBLE') || suggestions.suggestedUrgency,
      keywords: suggestions.keywords
    };
    onAccept(allAccepted);
    onClose();
  };

  const formatPrice = (pence: number) => (pence / 100).toFixed(0);

  const getCategoryLabel = () => {
    switch (category) {
      case 'TOOLS': return 'Tool Request';
      case 'EXPERTISE': return 'Service Request';
      case 'SPACE': return 'Space Request';
      default: return 'Request';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            AI Generated {getCategoryLabel()}
          </DialogTitle>
          <DialogDescription>
            Review the AI suggestions below. Click on any field to accept or edit it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Title */}
          <RequestField
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
          <RequestField
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

          {/* Budget & Rate Type */}
          <div className="grid grid-cols-2 gap-4">
            <RequestField
              label="Suggested Budget"
              icon={<PoundSterling className="w-4 h-4" />}
              value={suggestions.suggestedBudget}
              displayValue={`£${formatPrice(suggestions.suggestedBudget)}`}
              fieldState={getFieldState('suggestedBudget', suggestions.suggestedBudget)}
              onToggleAccept={() => toggleAccept('suggestedBudget', suggestions.suggestedBudget)}
              onStartEdit={() => startEditing('suggestedBudget', suggestions.suggestedBudget)}
              onUpdateValue={(v) => updateValue('suggestedBudget', parseInt(v as string) * 100)}
              onConfirmEdit={() => confirmEdit('suggestedBudget')}
              inputType="number"
            />

            {/* Rate Type */}
            <div className={`rounded-lg border overflow-hidden transition-colors ${
              getFieldState('suggestedRateType', suggestions.suggestedRateType).accepted
                ? 'border-green-300 bg-green-50/50'
                : 'border-gray-200'
            }`}>
              <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="font-medium text-sm">Rate Type</span>
                  {getFieldState('suggestedRateType', suggestions.suggestedRateType).accepted && (
                    <Badge className="bg-green-600 text-white text-xs">Accepted</Badge>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={getFieldState('suggestedRateType', suggestions.suggestedRateType).accepted ? 'default' : 'outline'}
                  className={`h-7 ${getFieldState('suggestedRateType', suggestions.suggestedRateType).accepted ? 'bg-green-600 hover:bg-green-700' : ''}`}
                  onClick={() => toggleAccept('suggestedRateType', suggestions.suggestedRateType)}
                >
                  <Check className="w-3 h-3" />
                </Button>
              </div>
              <div className="p-4">
                {getFieldState('suggestedRateType', suggestions.suggestedRateType).editing ? (
                  <Select
                    value={getFieldState('suggestedRateType', suggestions.suggestedRateType).value as string}
                    onValueChange={(v) => {
                      updateValue('suggestedRateType', v);
                      confirmEdit('suggestedRateType');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIXED">Fixed Price</SelectItem>
                      <SelectItem value="HOURLY">Per Hour</SelectItem>
                      <SelectItem value="DAILY">Per Day</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${
                      getFieldState('suggestedRateType', suggestions.suggestedRateType).accepted
                        ? 'text-green-800'
                        : 'text-gray-700'
                    }`}>
                      {RATE_TYPE_LABELS[suggestions.suggestedRateType]}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => startEditing('suggestedRateType', suggestions.suggestedRateType)}
                      className="h-7 px-2"
                    >
                      <Edit3 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Urgency */}
          <div className={`rounded-lg border overflow-hidden transition-colors ${
            getFieldState('suggestedUrgency', suggestions.suggestedUrgency).accepted
              ? 'border-green-300 bg-green-50/50'
              : 'border-gray-200'
          }`}>
            <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-sm">Urgency</span>
                {getFieldState('suggestedUrgency', suggestions.suggestedUrgency).accepted && (
                  <Badge className="bg-green-600 text-white text-xs">Accepted</Badge>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant={getFieldState('suggestedUrgency', suggestions.suggestedUrgency).accepted ? 'default' : 'outline'}
                className={`h-7 ${getFieldState('suggestedUrgency', suggestions.suggestedUrgency).accepted ? 'bg-green-600 hover:bg-green-700' : ''}`}
                onClick={() => toggleAccept('suggestedUrgency', suggestions.suggestedUrgency)}
              >
                <Check className="w-3 h-3" />
              </Button>
            </div>
            <div className="p-4">
              {getFieldState('suggestedUrgency', suggestions.suggestedUrgency).editing ? (
                <Select
                  value={getFieldState('suggestedUrgency', suggestions.suggestedUrgency).value as string}
                  onValueChange={(v) => {
                    updateValue('suggestedUrgency', v);
                    confirmEdit('suggestedUrgency');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(URGENCY_LABELS).map(([key, { label, description }]) => (
                      <SelectItem key={key} value={key}>
                        {label} - {description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`text-sm font-medium ${
                      getFieldState('suggestedUrgency', suggestions.suggestedUrgency).accepted
                        ? 'text-green-800'
                        : 'text-gray-700'
                    }`}>
                      {URGENCY_LABELS[suggestions.suggestedUrgency]?.label || suggestions.suggestedUrgency}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      {URGENCY_LABELS[suggestions.suggestedUrgency]?.description}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => startEditing('suggestedUrgency', suggestions.suggestedUrgency)}
                    className="h-7 px-2"
                  >
                    <Edit3 className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Keywords */}
          {suggestions.keywords && suggestions.keywords.length > 0 && (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 flex items-center gap-2">
                <Tag className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-sm">Search Keywords</span>
                <span className="text-xs text-gray-400">(for better visibility)</span>
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
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
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

// Helper component for text/number fields
interface RequestFieldProps {
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

function RequestField({
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
}: RequestFieldProps) {
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
