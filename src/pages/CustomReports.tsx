import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Trash, Calendar, Users, MapPin, Tag, Edit, Eye, RefreshCw, Loader2, Package, LayoutDashboard, ShoppingCart, Home, Briefcase, Store, Download } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { MultiSelect, Option } from '@/components/ui/multi-select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { getBaseUrl, apiFetch } from '@/lib/api';
import { toast } from 'sonner';

const MODULES = [
  { id: 'sales', label: 'Sales Reports', icon: ShoppingCart },
  { id: 'accommodation', label: 'Accommodation Reports', icon: Home },
  { id: 'inventory', label: 'Inventory Reports', icon: Package },
  { id: 'purchases', label: 'Purchases Reports', icon: Briefcase },
  { id: 'other', label: 'Other', icon: Store },
];

export default function CustomReports() {
  const { products, locations, customers, categories } = useInventory();
  const { allUsers } = useAuth();

  const [activeModule, setActiveModule] = useState('sales');
  const [reportTemplates, setReportTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [reportName, setReportName] = useState('');
  const [reportDesc, setReportDesc] = useState('');
  const [reportModule, setReportModule] = useState('sales');
  const [params, setParams] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Execute (Run Report) dialog
  const [executingTemplate, setExecutingTemplate] = useState<any | null>(null);
  const [execParams, setExecParams] = useState<Record<string, any>>({});
  const [isExecuting, setIsExecuting] = useState(false);

  const toggleParam = (param: string, isEdit = false) => {
    if (isEdit) {
      setEditParams(prev => prev.includes(param) ? prev.filter(p => p !== param) : [...prev, param]);
    } else {
      setParams(prev => prev.includes(param) ? prev.filter(p => p !== param) : [...prev, param]);
    }
  };


  // PDF Preview dialog
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Edit Template dialog
  const [editingReportTemplate, setEditingReportTemplate] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editModule, setEditModule] = useState('sales');
  const [editParams, setEditParams] = useState<string[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const locationOptionsForReport = useMemo(() =>
    locations.map(loc => ({ value: String(loc.id), label: loc.name })), [locations]);

  const productOptionsForReport = useMemo(() =>
    products.map(p => ({ value: String(p.id), label: p.name })), [products]);

  const categoryOptionsForReport = useMemo(() =>
    categories.map(cat => ({ value: cat.name, label: cat.name })), [categories]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch<any>('/api/reports/templates');
      if (res && res.data) setReportTemplates(res.data);
    } catch (err) {
      console.error('Failed to fetch report templates', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, []);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !reportName.trim()) { toast.error('File and report name are required'); return; }
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('name', reportName);
    formData.append('description', reportDesc);
    formData.append('module', reportModule);
    formData.append('params', params.join(','));
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`${getBaseUrl()}/api/reports/templates`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      toast.success('Report template uploaded successfully');
      setUploadFile(null); setReportName(''); setReportDesc(''); setReportModule('sales');
      setParams([]);
      setUploadOpen(false);
      fetchTemplates();
    } catch { toast.error('Failed to upload template'); }
    finally { setIsUploading(false); }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('Are you sure you want to delete this report template?')) return;
    try {
      await apiFetch(`/api/reports/templates/${id}`, { method: 'DELETE' });
      toast.success('Template deleted successfully');
      fetchTemplates();
    } catch { toast.error('Failed to delete template'); }
  };

  const handleExecuteReport = async () => {
    if (!executingTemplate) return;
    setIsExecuting(true);
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`${getBaseUrl()}/api/reports/templates/${executingTemplate.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ...execParams }),
      });
      if (!response.ok) throw new Error('Report generation failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      setPreviewUrl(url);
      setPreviewOpen(true);
      setExecutingTemplate(null);
    } catch { toast.error('Failed to execute report'); }
    finally { setIsExecuting(false); }
  };

  const startEdit = (template: any) => {
    setEditingReportTemplate(template);
    setEditName(template.name);
    setEditDesc(template.description || '');
    setEditFile(null);
    setEditModule(template.module || 'other');
    setEditParams(template.params ? template.params.split(',') : []);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReportTemplate || !editName.trim()) return;
    setIsSavingEdit(true);
    const formData = new FormData();
    formData.append('name', editName);
    formData.append('description', editDesc);
    formData.append('module', editModule);
    formData.append('params', editParams.join(','));
    if (editFile) {
      formData.append('file', editFile);
    }
    
    try {
      await apiFetch(`/api/reports/templates/${editingReportTemplate.id}`, {
        method: 'PUT', body: formData,
      });
      toast.success('Report template updated successfully');
      setEditingReportTemplate(null);
      fetchTemplates();
    } catch { toast.error('Failed to update template'); }
    finally { setIsSavingEdit(false); }
  };

  const displayedReports = useMemo(() => {
    return reportTemplates.filter(t => (t.module || 'other') === activeModule);
  }, [reportTemplates, activeModule]);

  return (
    <AppLayout>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 max-h-screen overflow-y-auto">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Custom Reports</h2>
          <div className="flex items-center space-x-2">
            <Button onClick={() => fetchTemplates()} variant="outline" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => setUploadOpen(true)} size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Upload Template
            </Button>
          </div>
        </div>

        <Tabs value={activeModule} onValueChange={setActiveModule} className="space-y-4">
          <TabsList className="grid grid-cols-2 md:grid-cols-5 bg-muted/50 p-1 rounded-lg">
            {MODULES.map(mod => {
              const Icon = mod.icon;
              return (
                <TabsTrigger key={mod.id} value={mod.id} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm rounded-md transition-all">
                  <Icon className="h-4 w-4 mr-2" />
                  {mod.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value={activeModule} className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : displayedReports.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <LayoutDashboard className="h-12 w-12 mb-4 opacity-20" />
                  <p>No custom reports uploaded for this category yet.</p>
                  <Button variant="link" onClick={() => { setReportModule(activeModule); setUploadOpen(true); }} className="mt-2">
                    Upload your first report here
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {displayedReports.map(template => (
                  <Card key={template.id} className="flex flex-col group hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg leading-tight">{template.name}</CardTitle>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => startEdit(template)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteTemplate(template.id)}>
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {template.description || 'No description provided.'}
                      </p>
                    </CardHeader>
                    <CardContent className="mt-auto pt-0 pb-4">
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {(template.params?.includes('dateRange')) && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Date Range</Badge>}
                        {(template.params?.includes('location')) && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Location</Badge>}
                        {(template.params?.includes('user')) && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">User</Badge>}
                        {(template.params?.includes('customer')) && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Customer</Badge>}
                        {(template.params?.includes('product')) && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Product</Badge>}
                        {(template.params?.includes('category')) && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Category</Badge>}
                        {(!template.params || template.params.trim() === '') && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-dashed text-muted-foreground">No Params</Badge>
                        )}
                      </div>
                      <Button
                        className="w-full h-8 text-xs font-medium bg-secondary/50 text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={() => {
                          setExecutingTemplate(template);
                          setExecParams({
                            ...((template.params?.includes('dateRange')) && { startDate: new Date().toISOString().slice(0,16), endDate: new Date().toISOString().slice(0,16) })
                          });
                        }}
                      >
                        <Eye className="h-3.5 w-3.5 mr-2" />
                        Run Report
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ── Upload Template Dialog ──────────────────────────────────────── */}
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Custom Report Template</DialogTitle>
              <DialogDescription>Select a .jrxml file and configure its required parameters.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs">Category (Module) *</Label>
                <Select value={reportModule} onValueChange={setReportModule} required>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODULES.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Report Name *</Label>
                <Input placeholder="e.g. Sales Summary" value={reportName} onChange={e => setReportName(e.target.value)} required className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input placeholder="Brief description..." value={reportDesc} onChange={e => setReportDesc(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">File (.jrxml) *</Label>
                <Input type="file" accept=".jrxml" onChange={e => setUploadFile(e.target.files?.[0] || null)} required className="h-9 py-1 text-xs" />
              </div>
              <div className="space-y-2 border-t pt-2">
                <Label className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block mb-1">
                  Configure Parameters to Prompt For:
                </Label>
                <div className="grid grid-cols-2 gap-2 text-xs font-medium">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="req-date" checked={params.includes('dateRange')} onCheckedChange={() => toggleParam('dateRange')} />
                    <label htmlFor="req-date" className="cursor-pointer flex items-center gap-1"><Calendar className="h-3 w-3" /> Date Range</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="req-loc" checked={params.includes('location')} onCheckedChange={() => toggleParam('location')} />
                    <label htmlFor="req-loc" className="cursor-pointer flex items-center gap-1"><MapPin className="h-3 w-3" /> Location</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="req-user" checked={params.includes('user')} onCheckedChange={() => toggleParam('user')} />
                    <label htmlFor="req-user" className="cursor-pointer flex items-center gap-1"><Users className="h-3 w-3" /> Cashier/User</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="req-cust" checked={params.includes('customer')} onCheckedChange={() => toggleParam('customer')} />
                    <label htmlFor="req-cust" className="cursor-pointer flex items-center gap-1"><Users className="h-3 w-3" /> Customer</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="req-prod" checked={params.includes('product')} onCheckedChange={() => toggleParam('product')} />
                    <label htmlFor="req-prod" className="cursor-pointer flex items-center gap-1"><Package className="h-3 w-3" /> Product/Item</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="req-cat" checked={params.includes('category')} onCheckedChange={() => toggleParam('category')} />
                    <label htmlFor="req-cat" className="cursor-pointer flex items-center gap-1"><Tag className="h-3 w-3" /> Category</label>
                  </div>
                </div>
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setUploadOpen(false)} disabled={isUploading}>Cancel</Button>
                <Button type="submit" disabled={isUploading}>{isUploading ? 'Uploading...' : 'Upload Template'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Run Report Parameter Dialog ─────────────────────────────────── */}
        <Dialog open={!!executingTemplate} onOpenChange={open => !open && setExecutingTemplate(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Run Report: {executingTemplate?.name}</DialogTitle>
              <DialogDescription>Provide values for the report parameters below.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {executingTemplate?.params?.includes('dateRange') && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Start Date</Label>
                    <Input type="datetime-local" value={execParams.startDate || ''} onChange={e => setExecParams(prev => ({ ...prev, startDate: e.target.value }))} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">End Date</Label>
                    <Input type="datetime-local" value={execParams.endDate || ''} onChange={e => setExecParams(prev => ({ ...prev, endDate: e.target.value }))} className="h-9" />
                  </div>
                </div>
              )}
              {executingTemplate?.params?.includes('location') && (
                <div className="space-y-1">
                  <Label className="text-xs">Locations</Label>
                  <MultiSelect
                    options={locationOptionsForReport}
                    selected={execParams.locationIds || []}
                    onChange={vals => setExecParams(prev => ({ ...prev, locationIds: vals }))}
                    placeholder="Select locations..."
                  />
                </div>
              )}
              {executingTemplate?.params?.includes('user') && (
                <div className="space-y-1">
                  <Label className="text-xs">User/Cashier</Label>
                  <Select onValueChange={val => setExecParams(prev => ({ ...prev, userId: val }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select User" /></SelectTrigger>
                    <SelectContent>
                      {allUsers.map(u => (
                        <SelectItem key={u.id} value={u.name}>{u.name} ({u.role})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {executingTemplate?.params?.includes('customer') && (
                <div className="space-y-1">
                  <Label className="text-xs">Customer</Label>
                  <Select onValueChange={val => setExecParams(prev => ({ ...prev, customerId: val }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select Customer" /></SelectTrigger>
                    <SelectContent>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {executingTemplate?.params?.includes('product') && (
                <div className="space-y-1">
                  <Label className="text-xs">Products/Items</Label>
                  <MultiSelect
                    options={productOptionsForReport}
                    selected={execParams.productIds || []}
                    onChange={vals => setExecParams(prev => ({ ...prev, productIds: vals }))}
                    placeholder="Select products..."
                  />
                </div>
              )}
              {executingTemplate?.params?.includes('category') && (
                <div className="space-y-1">
                  <Label className="text-xs">Categories</Label>
                  <MultiSelect
                    options={categoryOptionsForReport}
                    selected={execParams.categories || []}
                    onChange={vals => setExecParams(prev => ({ ...prev, categories: vals }))}
                    placeholder="Select categories..."
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExecutingTemplate(null)} disabled={isExecuting}>Cancel</Button>
              <Button onClick={handleExecuteReport} disabled={isExecuting}>
                {isExecuting ? 'Generating...' : 'Execute'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── PDF Preview Dialog ──────────────────────────────────────────── */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-5xl w-[90vw] h-[90vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-4 border-b bg-muted/20 flex-shrink-0">
              <DialogTitle>Report Preview</DialogTitle>
            </DialogHeader>
            <div className="flex-1 w-full bg-muted min-h-0 relative">
              {previewUrl && (
                <iframe src={previewUrl} className="absolute inset-0 w-full h-full border-none" title="Report PDF Preview" />
              )}
            </div>
            <DialogFooter className="p-4 border-t bg-card flex justify-between flex-shrink-0">
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
              {previewUrl && (
                <Button asChild>
                  <a href={previewUrl} download="report.pdf">Download PDF</a>
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Edit Template Dialog ────────────────────────────────────────── */}
        <Dialog open={!!editingReportTemplate} onOpenChange={open => !open && setEditingReportTemplate(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Report: {editingReportTemplate?.name}</DialogTitle>
              <DialogDescription>Update the metadata and required parameters for this report.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs">Category (Module) *</Label>
                <Select value={editModule} onValueChange={setEditModule} required>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODULES.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-end">
                  <Label className="text-xs">Report Name *</Label>
                  <Button variant="outline" size="sm" type="button" className="h-6 text-xs px-2" onClick={() => window.open(getBaseUrl() + `/api/reports/templates/${editingReportTemplate?.id}/download`, '_blank')}>
                    <Download className="h-3 w-3 mr-1" /> Download .jrxml
                  </Button>
                </div>
                <Input placeholder="e.g. Sales Summary" value={editName} onChange={e => setEditName(e.target.value)} required className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Update .jrxml File (Optional)</Label>
                <Input type="file" accept=".jrxml" onChange={e => setEditFile(e.target.files?.[0] || null)} className="h-9 cursor-pointer" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input placeholder="Brief description..." value={editDesc} onChange={e => setEditDesc(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-2 border-t pt-2">
                <Label className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block mb-1">
                  Configure Parameters to Prompt For:
                </Label>
                <div className="grid grid-cols-2 gap-2 text-xs font-medium">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="edit-req-date" checked={editParams.includes('dateRange')} onCheckedChange={() => toggleParam('dateRange', true)} />
                    <label htmlFor="edit-req-date" className="cursor-pointer flex items-center gap-1"><Calendar className="h-3 w-3" /> Date Range</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="edit-req-loc" checked={editParams.includes('location')} onCheckedChange={() => toggleParam('location', true)} />
                    <label htmlFor="edit-req-loc" className="cursor-pointer flex items-center gap-1"><MapPin className="h-3 w-3" /> Location</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="edit-req-user" checked={editParams.includes('user')} onCheckedChange={() => toggleParam('user', true)} />
                    <label htmlFor="edit-req-user" className="cursor-pointer flex items-center gap-1"><Users className="h-3 w-3" /> Cashier/User</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="edit-req-cust" checked={editParams.includes('customer')} onCheckedChange={() => toggleParam('customer', true)} />
                    <label htmlFor="edit-req-cust" className="cursor-pointer flex items-center gap-1"><Users className="h-3 w-3" /> Customer</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="edit-req-prod" checked={editParams.includes('product')} onCheckedChange={() => toggleParam('product', true)} />
                    <label htmlFor="edit-req-prod" className="cursor-pointer flex items-center gap-1"><Package className="h-3 w-3" /> Product/Item</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="edit-req-cat" checked={editParams.includes('category')} onCheckedChange={() => toggleParam('category', true)} />
                    <label htmlFor="edit-req-cat" className="cursor-pointer flex items-center gap-1"><Tag className="h-3 w-3" /> Category</label>
                  </div>
                </div>
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingReportTemplate(null)} disabled={isSavingEdit}>Cancel</Button>
                <Button type="submit" disabled={isSavingEdit}>{isSavingEdit ? 'Saving...' : 'Save Changes'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
