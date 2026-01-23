import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { SystemSettings } from '@/types/inventory';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Building2, Receipt, Bell, Database, Loader2 } from 'lucide-react';

export default function Settings() {
  const { settings, updateSettings, isLoading } = useInventory();
  const [formData, setFormData] = useState<SystemSettings | null>(null);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  if (isLoading || !formData) {
    return (
      <AppLayout title="Settings">
        <div className="flex h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const handleSave = async () => {
    if (formData) {
      await updateSettings(formData);
    }
  };

  const updateField = (field: keyof SystemSettings, value: any) => {
    setFormData(prev => prev ? { ...prev, [field]: value } : null);
  };

  return (
    <AppLayout title="Settings">
      <div className="max-w-3xl space-y-6">
        {/* Business Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Business Information</CardTitle>
                <CardDescription>Your business details for receipts and reports</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  value={formData.businessName}
                  onChange={(e) => updateField('businessName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.businessPhone}
                  onChange={(e) => updateField('businessPhone', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.businessAddress}
                onChange={(e) => updateField('businessAddress', e.target.value)}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.businessEmail}
                  onChange={(e) => updateField('businessEmail', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId">Tax ID</Label>
                <Input
                  id="taxId"
                  value={formData.taxId}
                  onChange={(e) => updateField('taxId', e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleSave}>Save Changes</Button>
          </CardContent>
        </Card>

        {/* POS Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>POS Settings</CardTitle>
                <CardDescription>Configure point of sale preferences</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  value={formData.taxRate}
                  onChange={(e) => updateField('taxRate', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency Symbol</Label>
                <Input
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => updateField('currency', e.target.value)}
                />
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-print Receipts</Label>
                <p className="text-sm text-muted-foreground">Automatically print receipt after each sale</p>
              </div>
              <Switch
                checked={formData.autoPrintReceipts}
                onCheckedChange={(checked) => updateField('autoPrintReceipts', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Stock Warning</Label>
                <p className="text-sm text-muted-foreground">Alert when selling low stock items</p>
              </div>
              <Switch
                checked={formData.showStockWarning}
                onCheckedChange={(checked) => updateField('showStockWarning', checked)}
              />
            </div>
            <Button onClick={handleSave}>Save Changes</Button>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Configure alert preferences</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Low Stock Alerts</Label>
                <p className="text-sm text-muted-foreground">Get notified when items reach low stock threshold</p>
              </div>
              <Switch
                checked={formData.lowStockAlerts}
                onCheckedChange={(checked) => updateField('lowStockAlerts', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Out of Stock Alerts</Label>
                <p className="text-sm text-muted-foreground">Get notified when items are out of stock</p>
              </div>
              <Switch
                checked={formData.outOfStockAlerts}
                onCheckedChange={(checked) => updateField('outOfStockAlerts', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Daily Sales Summary</Label>
                <p className="text-sm text-muted-foreground">Receive daily sales report via email</p>
              </div>
              <Switch
                checked={formData.dailySalesSummary}
                onCheckedChange={(checked) => updateField('dailySalesSummary', checked)}
              />
            </div>
            <Button onClick={handleSave}>Save Changes</Button>
          </CardContent>
        </Card>

        {/* Data */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Data Management</CardTitle>
                <CardDescription>Export and backup your data</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <Button variant="outline">Export Products (CSV)</Button>
              <Button variant="outline">Export Sales (CSV)</Button>
              <Button variant="outline">Export Inventory (CSV)</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
