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
import { Building2, Receipt, Bell, Database, Loader2, Globe } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import ShippingSettings from '@/components/settings/ShippingSettings';
import EcommerceSettingsUI from '@/components/settings/EcommerceSettingsUI';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Settings() {
  const { settings, updateSettings, isLoading, categories = [] } = useInventory();
  const [formData, setFormData] = useState<SystemSettings | null>(null);
  const [localPrinterName, setLocalPrinterName] = useState(() => localStorage.getItem('localPrinterName') || 'Receipt Printer');
  const [printers, setPrinters] = useState<string[]>([]);
  const [isFetchingPrinters, setIsFetchingPrinters] = useState(false);
  const [printerMappings, setPrinterMappings] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchPrinters = async () => {
      setIsFetchingPrinters(true);
      try {
        const response = await fetch('http://localhost:9000/printers');
        if (response.ok) {
          const data = await response.json();
          setPrinters(data);
        }
      } catch (err) {
        console.warn("Local print service offline, cannot fetch printer list.");
      } finally {
        setIsFetchingPrinters(false);
      }
    };
    fetchPrinters();
  }, []);

  useEffect(() => {
    if (categories.length > 0) {
      setPrinterMappings(prev => {
        const mappings = { ...prev };
        categories.forEach(cat => {
          if (!mappings[cat.name]) {
            mappings[cat.name] = localStorage.getItem(`printer_mapping_${cat.name}`) || 'Receipt Printer';
          }
        });
        return mappings;
      });
    }
  }, [categories]);

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
      localStorage.setItem('localPrinterName', localPrinterName);
      Object.entries(printerMappings).forEach(([catName, printerName]) => {
        localStorage.setItem(`printer_mapping_${catName}`, printerName);
      });
    }
  };

  const updateField = (field: keyof SystemSettings, value: any) => {
    setFormData(prev => prev ? { ...prev, [field]: value } : null);
  };

  return (
    <AppLayout title="Settings">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="general">Store Settings</TabsTrigger>
          <TabsTrigger value="ecommerce">eCommerce Stylings</TabsTrigger>
          <TabsTrigger value="shipping">Shipping Management</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
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
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow Negative Stock</Label>
                  <p className="text-sm text-muted-foreground">Allow processing sales even if stock is unavailable</p>
                </div>
                <Switch
                  checked={formData.allowNegativeStock}
                  onCheckedChange={(checked) => updateField('allowNegativeStock', checked)}
                />
              </div>
              <div className="flex items-center justify-between border-t pt-4">
                <div className="space-y-0.5 flex-1 pr-4">
                  <Label htmlFor="localPrinterName">Local Printer Name</Label>
                  <p className="text-sm text-muted-foreground">Select the printer on this local workstation</p>
                </div>
                {printers.length > 0 ? (
                  <Select value={localPrinterName} onValueChange={setLocalPrinterName}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select a printer" />
                    </SelectTrigger>
                    <SelectContent>
                      {printers.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      id="localPrinterName"
                      value={localPrinterName}
                      onChange={(e) => setLocalPrinterName(e.target.value)}
                      className="w-56"
                      placeholder="e.g. Receipt Printer"
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-10 text-xs"
                      onClick={async () => {
                        try {
                          const res = await fetch('http://localhost:9000/printers');
                          if (res.ok) {
                            const data = await res.json();
                            setPrinters(data);
                            toast.success('Printers loaded successfully!');
                          } else {
                            toast.error('Failed to load printers.');
                          }
                        } catch (e) {
                          toast.error('Print service is still offline.');
                        }
                      }}
                    >
                      Reload
                    </Button>
                  </div>
                )}
              </div>
              <div className="border-t pt-4 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">KOT Printer Mappings (By Category)</h4>
                  <p className="text-xs text-muted-foreground">Map different product categories to specific kitchen/bar printers</p>
                </div>
                {categories.length > 0 ? (
                  <div className="space-y-3 pl-2">
                    {categories.map(cat => (
                      <div key={cat.id} className="flex items-center justify-between gap-4">
                        <Label className="text-xs font-medium">{cat.name}</Label>
                        {printers.length > 0 ? (
                          <Select 
                            value={printerMappings[cat.name] || 'Receipt Printer'} 
                            onValueChange={(val) => setPrinterMappings(prev => ({ ...prev, [cat.name]: val }))}
                          >
                            <SelectTrigger className="w-64">
                              <SelectValue placeholder="Select KOT printer" />
                            </SelectTrigger>
                            <SelectContent>
                              {printers.map((p) => (
                                <SelectItem key={p} value={p}>
                                  {p}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={printerMappings[cat.name] || ''}
                            onChange={(e) => setPrinterMappings(prev => ({ ...prev, [cat.name]: e.target.value }))}
                            className="w-64"
                            placeholder="e.g. Kitchen Printer"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No categories available to map.</p>
                )}
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
        </TabsContent>

        <TabsContent value="ecommerce">
          <EcommerceSettingsUI />
        </TabsContent>

        <TabsContent value="shipping">
          <ShippingSettings />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
