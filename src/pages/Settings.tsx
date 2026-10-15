import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { SystemSettings } from '@/types/inventory';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Building2, Receipt, Bell, Database, Loader2, Globe, Server, CheckCircle2, RotateCcw, Clock, Plus, Trash2, Palette, Sun, Moon, Laptop, Check } from 'lucide-react';
import { ShiftSchedule } from '@/types/shift';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import ShippingSettings from '@/components/settings/ShippingSettings';
import EcommerceSettingsUI from '@/components/settings/EcommerceSettingsUI';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getBaseUrl, setBaseUrl, clearBaseUrl, apiFetch } from '@/lib/api';
import { useTheme } from '@/contexts/ThemeContext';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Compact settings card — module-level so inputs inside keep focus across renders. */
function SectionCard({
  icon: Icon, title, desc, children, className = '',
}: { icon: LucideIcon; title: string; desc?: string; children: ReactNode; className?: string }) {
  return (
    <Card className={`shadow-sm ${className}`}>
      <CardHeader className="p-4 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-sm leading-none">{title}</CardTitle>
            {desc && <CardDescription className="mt-1 text-xs leading-snug">{desc}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-1">{children}</CardContent>
    </Card>
  );
}

function ToggleRow({
  label, desc, checked, onChange,
}: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
      <div className="min-w-0 space-y-0.5">
        <Label className="text-[13px] font-medium">{label}</Label>
        {desc && <p className="text-xs leading-snug text-muted-foreground">{desc}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5 shrink-0" />
    </div>
  );
}

const fieldLabel = 'text-xs font-medium text-muted-foreground';

/** Admin editor for the recurring windows Automatic shift mode rotates through. */
function ShiftScheduleEditor() {
  const [schedules, setSchedules] = useState<ShiftSchedule[]>([]);

  const load = async () => {
    try {
      const res = await apiFetch<{ data: ShiftSchedule[] }>('/api/shifts/schedules');
      setSchedules(res.data || []);
    } catch {
      // non-fatal - editor just stays empty until the next successful load
    }
  };

  useEffect(() => { load(); }, []);

  const updateLocal = (idx: number, patch: Partial<ShiftSchedule>) => {
    setSchedules(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const save = async (s: ShiftSchedule) => {
    if (!s.name?.trim()) {
      toast.error('Give the schedule a name first');
      return;
    }
    try {
      if (s.id) {
        await apiFetch(`/api/shifts/schedules/${s.id}`, { method: 'PUT', body: JSON.stringify(s) });
      } else {
        await apiFetch('/api/shifts/schedules', { method: 'POST', body: JSON.stringify(s) });
      }
      toast.success('Schedule saved');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save schedule');
    }
  };

  const remove = async (id: number) => {
    try {
      await apiFetch(`/api/shifts/schedules/${id}`, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete schedule');
    }
  };

  return (
    <div className="space-y-2">
      {schedules.map((s, idx) => (
        <div key={s.id ?? `new-${idx}`} className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2">
          <Input className="h-8 w-28 text-xs" placeholder="e.g. Morning" value={s.name}
            onChange={(e) => updateLocal(idx, { name: e.target.value })} />
          <Input className="h-8 w-28 text-xs" type="time" value={(s.startTime || '').slice(0, 5)}
            onChange={(e) => updateLocal(idx, { startTime: e.target.value })} />
          <span className="text-xs text-muted-foreground">to</span>
          <Input className="h-8 w-28 text-xs" type="time" value={(s.endTime || '').slice(0, 5)}
            onChange={(e) => updateLocal(idx, { endTime: e.target.value })} />
          <div className="flex items-center gap-1.5">
            <Switch checked={s.active} onCheckedChange={(v) => updateLocal(idx, { active: v })} />
            <span className="text-xs text-muted-foreground">Active</span>
          </div>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => save(schedules[idx])}>Save</Button>
          {s.id != null && (
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => remove(s.id!)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ))}
      <Button size="sm" variant="outline" className="h-8 text-xs"
        onClick={() => setSchedules(prev => [...prev, { name: '', startTime: '06:00', endTime: '14:00', active: true }])}>
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Schedule
      </Button>
    </div>
  );
}

export default function Settings() {
  const { settings, updateSettings, isLoading, categories = [] } = useInventory();
  const { themeMode, setThemeMode, primaryColor, setPrimaryColor, colorPresets } = useTheme();
  const [formData, setFormData] = useState<SystemSettings | null>(null);
  const [localPrinterName, setLocalPrinterName] = useState(() => localStorage.getItem('localPrinterName') || 'Receipt Printer');
  const [printers, setPrinters] = useState<string[]>([]);
  const [isFetchingPrinters, setIsFetchingPrinters] = useState(false);
  const [printerMappings, setPrinterMappings] = useState<Record<string, string>>({});
  const [kotCatSearch, setKotCatSearch] = useState('');

  // Connection state
  const [serverUrl, setServerUrlInput] = useState(getBaseUrl);
  const [serverSavedFlash, setServerSavedFlash] = useState(false);

  const handleSaveServerUrl = () => {
    if (!serverUrl.trim()) return;
    setBaseUrl(serverUrl.trim());
    setServerSavedFlash(true);
    toast.success('Backend URL updated. Changes take effect on next API call.');
    setTimeout(() => setServerSavedFlash(false), 2000);
  };

  const handleResetServerUrl = () => {
    clearBaseUrl();
    setServerUrlInput(getBaseUrl());
    toast.info('Backend URL reset to default.');
  };

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
        // Only main categories get a KOT printer mapping; sub-categories inherit their parent's.
        categories.filter(cat => !cat.parentId).forEach(cat => {
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
      setFormData({
        ...settings,
        shiftMode: settings.shiftMode || 'MANUAL',
        shiftScope: settings.shiftScope || 'PER_LOCATION',
        themeMode: settings.themeMode || themeMode || 'system',
        primaryColor: settings.primaryColor || primaryColor || 'warm-amber',
      });
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

  // KOT printer mappings are per main category only (sub-categories inherit their parent's).
  // A category counts as "main" when it has no parentId, or its parentId points nowhere.
  const categoryIds = new Set(categories.map(c => c.id));
  const mainCategories = categories.filter(c => c.parentId == null || !categoryIds.has(c.parentId));
  const kotCategories = mainCategories
    .filter(c => c.name.toLowerCase().includes(kotCatSearch.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const reloadPrinters = async () => {
    try {
      const res = await fetch('http://localhost:9000/printers');
      if (res.ok) {
        setPrinters(await res.json());
        toast.success('Printers loaded successfully!');
      } else {
        toast.error('Failed to load printers.');
      }
    } catch (e) {
      toast.error('Print service is still offline.');
    }
  };

  return (
    <AppLayout title="Settings">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-4 h-9">
          <TabsTrigger value="general" className="text-xs">Store</TabsTrigger>
          <TabsTrigger value="appearance" className="text-xs flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5" /> Appearance
          </TabsTrigger>
          <TabsTrigger value="ecommerce" className="text-xs">eCommerce</TabsTrigger>
          <TabsTrigger value="shipping" className="text-xs">Shipping</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="pb-4">
          <div className="grid items-start gap-3 lg:grid-cols-2">

            {/* Business Info */}
            <SectionCard icon={Building2} title="Business Information" desc="Shown on receipts and reports">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="businessName" className={fieldLabel}>Business Name</Label>
                  <Input id="businessName" className="h-9" value={formData.businessName} onChange={(e) => updateField('businessName', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone" className={fieldLabel}>Phone</Label>
                  <Input id="phone" className="h-9" value={formData.businessPhone} onChange={(e) => updateField('businessPhone', e.target.value)} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="address" className={fieldLabel}>Address</Label>
                  <Input id="address" className="h-9" value={formData.businessAddress} onChange={(e) => updateField('businessAddress', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email" className={fieldLabel}>Email</Label>
                  <Input id="email" type="email" className="h-9" value={formData.businessEmail} onChange={(e) => updateField('businessEmail', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="taxId" className={fieldLabel}>Tax ID</Label>
                  <Input id="taxId" className="h-9" value={formData.taxId} onChange={(e) => updateField('taxId', e.target.value)} />
                </div>
              </div>
            </SectionCard>

            {/* Notifications */}
            <SectionCard icon={Bell} title="Notifications" desc="Alert preferences">
              <ToggleRow label="Low Stock Alerts" desc="Notify when items reach the low-stock threshold"
                checked={formData.lowStockAlerts} onChange={(v) => updateField('lowStockAlerts', v)} />
              <ToggleRow label="Out of Stock Alerts" desc="Notify when items hit zero"
                checked={formData.outOfStockAlerts} onChange={(v) => updateField('outOfStockAlerts', v)} />
              <ToggleRow label="Daily Sales Summary" desc="Email a daily sales report"
                checked={formData.dailySalesSummary} onChange={(v) => updateField('dailySalesSummary', v)} />
            </SectionCard>

            {/* POS Settings — full width */}
            <SectionCard icon={Receipt} title="POS & Receipt" desc="Point of sale, tax and receipt content" className="lg:col-span-2">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="taxRate" className={fieldLabel}>Tax Rate (%)</Label>
                  <Input id="taxRate" type="number" className="h-9" value={formData.taxRate} onChange={(e) => updateField('taxRate', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="currency" className={fieldLabel}>Currency Symbol</Label>
                  <Input id="currency" className="h-9" value={formData.currency} onChange={(e) => updateField('currency', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="maxHeldOrders" className={fieldLabel}>Max Held Orders (0 = ∞)</Label>
                  <Input id="maxHeldOrders" type="number" min={0} className="h-9" value={formData.maxHeldOrders ?? 10}
                    onChange={(e) => updateField('maxHeldOrders', Math.max(0, parseInt(e.target.value) || 0))} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="receiptPaymentDetails" className={fieldLabel}>Payment Details on Receipt</Label>
                  <Textarea id="receiptPaymentDetails" rows={3} className="text-xs"
                    placeholder={"M-Pesa Paybill 123456, Acc: phone\nBank: Equity 0100xxxxxx"}
                    value={formData.receiptPaymentDetails || ''}
                    onChange={(e) => updateField('receiptPaymentDetails', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="receiptFooter" className={fieldLabel}>Receipt Footer</Label>
                  <Textarea id="receiptFooter" rows={3} className="text-xs"
                    placeholder="Thank you for your business!"
                    value={formData.receiptFooter || ''}
                    onChange={(e) => updateField('receiptFooter', e.target.value)} />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <ToggleRow label="Amount Inclusive of VAT" desc="On = tax extracted from the amount; Off = tax added on top"
                  checked={!!formData.vatInclusive} onChange={(v) => updateField('vatInclusive', v)} />
                <ToggleRow label="Auto-print Receipts" desc="Print the receipt straight after each sale"
                  checked={formData.autoPrintReceipts} onChange={(v) => updateField('autoPrintReceipts', v)} />
                <ToggleRow label="Show Stock Warning" desc="Warn when selling low-stock items"
                  checked={formData.showStockWarning} onChange={(v) => updateField('showStockWarning', v)} />
                <ToggleRow label="Allow Negative Stock" desc="Default for all products; a product can override it"
                  checked={formData.allowNegativeStock} onChange={(v) => updateField('allowNegativeStock', v)} />
                <ToggleRow label="Enable Table Management" desc="Restaurant mode: table picker + open-bills board"
                  checked={!!formData.enableTableManagement} onChange={(v) => updateField('enableTableManagement', v)} />
              </div>

              <Separator />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="localPrinterName" className={fieldLabel}>Local Printer (this workstation)</Label>
                {printers.length > 0 ? (
                  <Select value={localPrinterName} onValueChange={setLocalPrinterName}>
                    <SelectTrigger className="h-9 w-64"><SelectValue placeholder="Select a printer" /></SelectTrigger>
                    <SelectContent>
                      {printers.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex gap-2">
                    <Input id="localPrinterName" value={localPrinterName} onChange={(e) => setLocalPrinterName(e.target.value)}
                      className="h-9 w-52" placeholder="e.g. Receipt Printer" />
                    <Button variant="outline" size="sm" className="h-9 text-xs" onClick={reloadPrinters}>Reload</Button>
                  </div>
                )}
              </div>

              <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-semibold">KOT Printer Mappings</h4>
                    <p className="text-xs text-muted-foreground">Route main categories to kitchen/bar printers</p>
                  </div>
                  {mainCategories.length > 0 && (
                    <Input value={kotCatSearch} onChange={(e) => setKotCatSearch(e.target.value)}
                      placeholder="Search categories..." className="h-8 w-48 text-xs" />
                  )}
                </div>
                {mainCategories.length > 0 ? (
                  kotCategories.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {kotCategories.map(cat => (
                        <div key={cat.id} className="flex items-center justify-between gap-2">
                          <Label className="truncate text-xs font-medium">{cat.name}</Label>
                          {printers.length > 0 ? (
                            <Select value={printerMappings[cat.name] || 'Receipt Printer'}
                              onValueChange={(val) => setPrinterMappings(prev => ({ ...prev, [cat.name]: val }))}>
                              <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="KOT printer" /></SelectTrigger>
                              <SelectContent>
                                {printers.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input value={printerMappings[cat.name] || ''} className="h-8 w-44 text-xs"
                              onChange={(e) => setPrinterMappings(prev => ({ ...prev, [cat.name]: e.target.value }))}
                              placeholder="e.g. Kitchen Printer" />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground">No categories match "{kotCatSearch}".</p>
                  )
                ) : (
                  <p className="text-xs italic text-muted-foreground">No categories available to map.</p>
                )}
              </div>
            </SectionCard>

            {/* Shift Management */}
            <SectionCard icon={Clock} title="Shift Management" desc="Automatic or manual cashier shifts, applied across every module" className="lg:col-span-2">
              <ToggleRow label="Enable Shift Management" desc="Master switch — when off, nothing else here has any effect anywhere in the system"
                checked={!!formData.enableShiftManagement} onChange={(v) => updateField('enableShiftManagement', v)} />
              {formData.enableShiftManagement && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className={fieldLabel}>Shift Mode</Label>
                      <Select value={formData.shiftMode} onValueChange={(v) => updateField('shiftMode', v)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MANUAL">Manual — staff open &amp; close shifts</SelectItem>
                          <SelectItem value="AUTOMATIC">Automatic — rotates on a schedule</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className={fieldLabel}>Shift Scope</Label>
                      <Select value={formData.shiftScope} onValueChange={(v) => updateField('shiftScope', v)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PER_LOCATION">Per Location — each branch runs its own shift</SelectItem>
                          <SelectItem value="GLOBAL">Global — one shift covers every location</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {formData.shiftMode === 'MANUAL' && (
                    <ToggleRow label="Require Open Shift for Payments" desc="Block POS, Table Orders, Invoicing and Accommodation payments until a shift is opened"
                      checked={!!formData.requireOpenShiftToTransact} onChange={(v) => updateField('requireOpenShiftToTransact', v)} />
                  )}

                  {formData.shiftMode === 'AUTOMATIC' && (
                    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                      <h4 className="text-xs font-semibold">Shift Schedules</h4>
                      <p className="text-xs text-muted-foreground">
                        Windows the system rotates through automatically. A moment not covered by any schedule still
                        gets a "Default" shift, so nothing is ever left unstamped.
                      </p>
                      <ShiftScheduleEditor />
                    </div>
                  )}
                </>
              )}
            </SectionCard>

            {/* Backup */}
            <SectionCard icon={Database} title="Data & Backup" desc="Backups and exports">
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2">
                <div>
                  <p className="text-[13px] font-medium">System Backup</p>
                  <p className="text-xs text-muted-foreground">Manual backup of the whole database</p>
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs"
                  onClick={async () => {
                    try {
                      const loadingToast = toast.loading('Creating backup...');
                      const res = await fetch(getBaseUrl() + '/api/system-settings/backup', { method: 'POST' });
                      const data = await res.json();
                      toast.dismiss(loadingToast);
                      if (res.ok) { toast.success(data.message || 'Backup created successfully'); }
                      else { toast.error(data.message || 'Backup failed'); }
                    } catch (err: any) {
                      toast.dismiss();
                      toast.error('Network error during backup: ' + err.message);
                    }
                  }}>
                  <Database className="mr-1.5 h-3.5 w-3.5" /> Back up
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs">Export Products</Button>
                <Button variant="outline" size="sm" className="h-8 text-xs">Export Sales</Button>
                <Button variant="outline" size="sm" className="h-8 text-xs">Export Inventory</Button>
              </div>
            </SectionCard>

            {/* Connection */}
            <SectionCard icon={Server} title="Connection" desc="Backend API URL for this browser">
              <div className="space-y-1">
                <Label htmlFor="settingsServerUrl" className={fieldLabel}>Backend URL</Label>
                <Input id="settingsServerUrl" value={serverUrl} onChange={(e) => setServerUrlInput(e.target.value)}
                  placeholder="http://localhost:9090" className="h-9 font-mono text-xs" autoComplete="off" />
                <p className="text-xs text-muted-foreground">Saved in this browser only; applies to the next request.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={handleSaveServerUrl} disabled={serverSavedFlash}>
                  {serverSavedFlash ? <><CheckCircle2 className="h-3.5 w-3.5" /> Saved!</> : 'Save & Apply'}
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleResetServerUrl}>
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </Button>
              </div>
            </SectionCard>
          </div>

          {/* Sticky save bar */}
          <div className="sticky bottom-3 z-10 mt-3 flex justify-end">
            <Button onClick={handleSave} className="shadow-lg">Save all changes</Button>
          </div>
        </TabsContent>

        <TabsContent value="appearance" className="pb-4 space-y-4">
          <div className="grid items-start gap-3 lg:grid-cols-2">
            {/* Theme Mode */}
            <SectionCard icon={themeMode === 'dark' ? Moon : themeMode === 'light' ? Sun : Laptop} title="Theme Mode" desc="Choose interface display mode">
              <div className="grid grid-cols-3 gap-3 pt-1">
                {[
                  { id: 'light', label: 'Light', icon: Sun, desc: 'Clean & bright' },
                  { id: 'dark', label: 'Dark', icon: Moon, desc: 'Low-light friendly' },
                  { id: 'system', label: 'System', icon: Laptop, desc: 'Follows OS' },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = (formData?.themeMode || themeMode) === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        updateField('themeMode', item.id);
                        setThemeMode(item.id as any);
                      }}
                      className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all ${
                        active
                          ? 'border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/30'
                          : 'border-border bg-card hover:bg-muted/50 text-foreground'
                      }`}
                    >
                      <Icon className={`h-5 w-5 mb-1.5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-xs font-semibold">{item.label}</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            {/* Color Scheme */}
            <SectionCard icon={Palette} title="Primary Color Scheme" desc="Accent colors for buttons, highlights, and borders">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                {colorPresets.map((preset) => {
                  const active = (formData?.primaryColor || primaryColor) === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        updateField('primaryColor', preset.id);
                        setPrimaryColor(preset.id);
                      }}
                      className={`flex flex-col items-center p-2.5 rounded-xl border transition-all text-left ${
                        active
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm'
                          : 'border-border bg-card hover:bg-muted/40'
                      }`}
                    >
                      <div
                        className="w-7 h-7 rounded-full mb-1.5 shadow-sm flex items-center justify-center border border-black/10"
                        style={{ backgroundColor: preset.hex }}
                      >
                        {active && <Check className="h-3.5 w-3.5 text-white drop-shadow" />}
                      </div>
                      <span className="text-[11px] font-medium text-foreground text-center truncate w-full">
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </SectionCard>
          </div>

          {/* Sticky save bar */}
          <div className="sticky bottom-3 z-10 mt-3 flex justify-end">
            <Button onClick={handleSave} className="shadow-lg">Save all changes</Button>
          </div>
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
