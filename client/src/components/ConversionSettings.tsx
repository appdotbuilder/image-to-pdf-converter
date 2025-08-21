import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Settings2, FileText, RotateCcw, Save, Check } from 'lucide-react';
import type { PageSize, Orientation } from '../../../server/src/schema';

interface ConversionSettingsProps {
  pageSize: PageSize;
  orientation: Orientation;
  onSettingsChange: (pageSize: PageSize, orientation: Orientation) => Promise<void>;
  disabled?: boolean;
}

const PAGE_SIZE_OPTIONS: Array<{ value: PageSize; label: string; description: string }> = [
  { value: 'a4', label: 'A4', description: '210 × 297 mm' },
  { value: 'letter', label: 'Letter', description: '8.5 × 11 in' },
  { value: 'legal', label: 'Legal', description: '8.5 × 14 in' },
  { value: 'a3', label: 'A3', description: '297 × 420 mm' },
  { value: 'a5', label: 'A5', description: '148 × 210 mm' }
];

const ORIENTATION_OPTIONS: Array<{ value: Orientation; label: string; icon: string }> = [
  { value: 'portrait', label: 'Portrait', icon: '📄' },
  { value: 'landscape', label: 'Landscape', icon: '📑' }
];

export function ConversionSettings({ 
  pageSize, 
  orientation, 
  onSettingsChange, 
  disabled = false 
}: ConversionSettingsProps) {
  const [localPageSize, setLocalPageSize] = useState<PageSize>(pageSize);
  const [localOrientation, setLocalOrientation] = useState<Orientation>(orientation);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Check if settings have changed
  const updateHasChanges = (newPageSize: PageSize, newOrientation: Orientation) => {
    setHasChanges(newPageSize !== pageSize || newOrientation !== orientation);
  };

  const handlePageSizeChange = (value: PageSize) => {
    setLocalPageSize(value);
    updateHasChanges(value, localOrientation);
  };

  const handleOrientationChange = (value: Orientation) => {
    setLocalOrientation(value);
    updateHasChanges(localPageSize, value);
  };

  const handleSave = async () => {
    if (!hasChanges || disabled) return;

    setIsSaving(true);
    try {
      await onSettingsChange(localPageSize, localOrientation);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setLocalPageSize(pageSize);
    setLocalOrientation(orientation);
    setHasChanges(false);
  };

  const getPageSizeInfo = (size: PageSize) => {
    return PAGE_SIZE_OPTIONS.find(option => option.value === size);
  };

  const getOrientationInfo = (orient: Orientation) => {
    return ORIENTATION_OPTIONS.find(option => option.value === orient);
  };

  return (
    <Card className={disabled ? 'opacity-75' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          PDF Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Settings Display */}
        {!hasChanges && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Current Settings</span>
            </div>
            <div className="space-y-1 text-sm text-gray-600">
              <div>Page Size: {getPageSizeInfo(pageSize)?.label} ({getPageSizeInfo(pageSize)?.description})</div>
              <div>Orientation: {getOrientationInfo(orientation)?.icon} {getOrientationInfo(orientation)?.label}</div>
            </div>
          </div>
        )}

        {/* Page Size Selection */}
        <div className="space-y-2">
          <Label htmlFor="page-size" className="text-sm font-medium">
            Page Size
          </Label>
          <Select
            value={localPageSize}
            onValueChange={handlePageSizeChange}
            disabled={disabled}
          >
            <SelectTrigger id="page-size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-gray-500 text-sm ml-2">{option.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Orientation Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Orientation
          </Label>
          <div className="grid grid-cols-2 gap-3">
            {ORIENTATION_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => handleOrientationChange(option.value)}
                disabled={disabled}
                className={`
                  p-3 rounded-lg border-2 text-left transition-all
                  ${localOrientation === option.value 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-gray-200 bg-white hover:border-gray-300'
                  }
                  ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{option.icon}</span>
                  <span className="font-medium">{option.label}</span>
                </div>
                {localOrientation === option.value && (
                  <Badge variant="secondary" className="mt-2 text-xs">
                    Selected
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        {hasChanges && (
          <div className="flex gap-2 pt-2">
            <Button 
              onClick={handleSave}
              disabled={isSaving || disabled}
              size="sm"
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <Save className="mr-2 h-4 w-4 animate-pulse" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
            <Button 
              variant="outline"
              onClick={handleReset}
              disabled={isSaving || disabled}
              size="sm"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Settings Preview */}
        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Preview</h4>
          <div className="flex justify-center">
            <div 
              className={`
                border-2 border-gray-300 bg-white shadow-sm
                ${localOrientation === 'portrait' ? 'w-16 h-20' : 'w-20 h-16'}
              `}
            >
              <div className="h-full flex items-center justify-center">
                <div className="text-xs text-gray-500 text-center leading-tight">
                  {getPageSizeInfo(localPageSize)?.label}
                  <br />
                  {getOrientationInfo(localOrientation)?.icon}
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 text-center mt-2">
            {getPageSizeInfo(localPageSize)?.description} · {getOrientationInfo(localOrientation)?.label}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}