import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesService } from '@/api/services';
import type { UpdateInvoiceSettingsData } from '@/api/services';
import useAuth from '@/hooks/use-auth';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, FileText, Building2, Receipt, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import SEO from '@/components/SEO';

export default function InvoiceSettings(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch current settings
  const { data, isLoading } = useQuery({
    queryKey: ['invoice-settings'],
    queryFn: () => invoicesService.getSettings(),
    enabled: !!user,
  });

  const settings = data?.settings;

  // Form state
  const [formData, setFormData] = useState<UpdateInvoiceSettingsData>({});

  // Update when settings load
  const currentSettings = {
    businessName: formData.businessName ?? settings?.businessName ?? '',
    address: formData.address ?? settings?.address ?? '',
    city: formData.city ?? settings?.city ?? '',
    postcode: formData.postcode ?? settings?.postcode ?? '',
    country: formData.country ?? settings?.country ?? 'GB',
    vatNumber: formData.vatNumber ?? settings?.vatNumber ?? '',
    vatRegistered: formData.vatRegistered ?? settings?.vatRegistered ?? false,
  };

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateInvoiceSettingsData) => invoicesService.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-settings'] });
      toast.success('Invoice settings saved');
      setFormData({});
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save settings');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await updateMutation.mutateAsync({
        businessName: currentSettings.businessName || null,
        address: currentSettings.address || null,
        city: currentSettings.city || null,
        postcode: currentSettings.postcode || null,
        country: currentSettings.country || 'GB',
        vatNumber: currentSettings.vatNumber || null,
        vatRegistered: currentSettings.vatRegistered,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof UpdateInvoiceSettingsData, value: string | boolean | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-gray-100 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    navigate('/profile');
    return <></>;
  }

  return (
    <>
      <SEO title="Invoice Settings" description="Manage your business details for invoices" />

      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-gray-100 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/profile')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Invoice Settings</h1>
              <p className="text-gray-600">Configure your business details for professional invoices</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Business Details Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Business Details
                </CardTitle>
                <CardDescription>
                  These details will appear on your invoices
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    placeholder="Your business or trading name"
                    value={currentSettings.businessName}
                    onChange={(e) => handleChange('businessName', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    placeholder="Street address"
                    value={currentSettings.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      placeholder="City"
                      value={currentSettings.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postcode">Postcode</Label>
                    <Input
                      id="postcode"
                      placeholder="AB12 3CD"
                      value={currentSettings.postcode}
                      onChange={(e) => handleChange('postcode', e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* VAT Settings Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  VAT Settings
                </CardTitle>
                <CardDescription>
                  Configure VAT for your invoices (UK 20% rate)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="vatRegistered">VAT Registered</Label>
                    <p className="text-sm text-gray-500">
                      Enable to include VAT on your invoices
                    </p>
                  </div>
                  <Switch
                    id="vatRegistered"
                    checked={currentSettings.vatRegistered}
                    onCheckedChange={(checked) => handleChange('vatRegistered', checked)}
                  />
                </div>

                {currentSettings.vatRegistered && (
                  <div className="space-y-2">
                    <Label htmlFor="vatNumber">VAT Number</Label>
                    <Input
                      id="vatNumber"
                      placeholder="GB123456789"
                      value={currentSettings.vatNumber}
                      onChange={(e) => handleChange('vatNumber', e.target.value.toUpperCase().replace(/\s/g, ''))}
                    />
                    <p className="text-xs text-gray-500">
                      UK VAT format: GB followed by 9 or 12 digits
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Links */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Quick Links
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => navigate('/invoices')}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View All Invoices
                </Button>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
