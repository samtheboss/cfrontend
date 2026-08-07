import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { Property, PropertyUnit, PropertyLease, Customer } from '@/types/inventory';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Plus,
  Trash2,
  Search,
  Calendar,
  User,
  Building,
  DollarSign,
  AlertTriangle,
  UserPlus,
  ChevronsUpDown,
  Check,
  RefreshCw,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

export default function Leases() {
  const { customers, addCustomer } = useInventory();
  const { user } = useAuth();

  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<PropertyUnit[]>([]);
  const [leases, setLeases] = useState<PropertyLease[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [isAddLeaseOpen, setIsAddLeaseOpen] = useState(false);
  const [isAddTenantOpen, setIsAddTenantOpen] = useState(false);
  const [invoiceConfirmLease, setInvoiceConfirmLease] = useState<PropertyLease | null>(null);
  const [isUnitPopoverOpen, setIsUnitPopoverOpen] = useState(false);
  const [isTenantPopoverOpen, setIsTenantPopoverOpen] = useState(false);

  // Form states
  const [newLease, setNewLease] = useState({
    tenantId: '',
    unitId: '',
    startDate: '',
    endDate: '',
    nextInvoiceDate: '',
    rentAmount: 0,
    depositAmount: 0,
    billingFrequency: 'MONTHLY',
  });

  const [newTenant, setNewTenant] = useState({
    name: '',
    email: '',
    phone: '',
    idNumber: '',
    customerType: 'TENANT',
  });

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const propRes = await apiFetch<{ data: Property[] }>('/api/pms/properties');
      const unitRes = await apiFetch<{ data: PropertyUnit[] }>('/api/pms/units');
      const leaseRes = await apiFetch<{ data: PropertyLease[] }>('/api/pms/leases');
      setProperties(propRes.data || []);
      setUnits(unitRes.data || []);
      setLeases(leaseRes.data || []);
    } catch (err: any) {
      toast.error('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter tenants from shared customers list
  const tenants = customers.filter(
    (c) => c.customerType === 'TENANT' || c.customerType === 'BOTH'
  );

  // Handle Quick Add Tenant (saves to main Customers DB)
  const handleSaveTenant = async () => {
    if (!newTenant.name) {
      toast.error('Please enter tenant name');
      return;
    }

    try {
      await addCustomer({
        name: newTenant.name,
        email: newTenant.email,
        phone: newTenant.phone,
        idNumber: newTenant.idNumber,
        customerType: 'TENANT',
      });
      toast.success('Tenant added to shared database');
      setNewTenant({ name: '', email: '', phone: '', idNumber: '', customerType: 'TENANT' });
      setIsAddTenantOpen(false);
    } catch (err: any) {
      toast.error('Failed to add tenant: ' + err.message);
    }
  };

  // Handle Save Lease
  const handleSaveLease = async () => {
    if (!newLease.tenantId || !newLease.unitId || !newLease.startDate || !newLease.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const payload = {
        ...newLease,
        tenantId: parseInt(newLease.tenantId),
        unitId: parseInt(newLease.unitId),
        rentAmount: parseFloat(newLease.rentAmount as any),
        depositAmount: parseFloat(newLease.depositAmount as any),
        createdBy: user?.name || user?.username || 'System',
      };

      await apiFetch('/api/pms/leases', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success('Lease agreement created successfully');
      setIsAddLeaseOpen(false);
      setNewLease({
        tenantId: '',
        unitId: '',
        startDate: '',
        endDate: '',
        nextInvoiceDate: '',
        rentAmount: 0,
        depositAmount: 0,
        billingFrequency: 'MONTHLY',
      });
      fetchData();
    } catch (err: any) {
      toast.error('Failed to create lease: ' + err.message);
    }
  };

  // Handle Terminate Lease
  const handleTerminateLease = async (id: number) => {
    if (!confirm('Are you sure you want to terminate this lease? The unit will be marked as vacant.')) return;

    try {
      await apiFetch(`/api/pms/leases/${id}/terminate`, {
        method: 'POST',
      });
      toast.success('Lease terminated');
      fetchData();
    } catch (err: any) {
      toast.error('Failed to terminate lease: ' + err.message);
    }
  };

  // Trigger individual invoice generation confirmation
  const handleGenerateInvoice = (lease: PropertyLease) => {
    setInvoiceConfirmLease(lease);
  };

  // Execute invoice generation after confirmation
  const handleConfirmGenerateInvoice = async () => {
    if (!invoiceConfirmLease) return;
    const leaseId = invoiceConfirmLease.id;
    setInvoiceConfirmLease(null);
    try {
      await apiFetch(`/api/pms/leases/${leaseId}/generate-invoice`, {
        method: 'POST',
      });
      toast.success('Invoice generated successfully for this lease!');
      fetchData();
    } catch (err: any) {
      toast.error('Failed to generate invoice: ' + err.message);
    }
  };

  // Helpers
  const getTenantName = (id: number) => {
    const cust = customers.find((c) => c.id === id.toString() || c.id === id);
    return cust ? cust.name : `Tenant #${id}`;
  };

  const getUnitName = (id: number) => {
    const u = units.find((unit) => unit.id === id);
    if (!u) return `Unit #${id}`;
    const p = properties.find((prop) => prop.id === u.propertyId);
    return p ? `${p.name} - Unit ${u.unitNumber}` : `Unit ${u.unitNumber}`;
  };

  const getLeaseStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">Active</Badge>;
      case 'EXPIRED':
        return <Badge variant="outline" className="text-amber-500 border-amber-500">Expired</Badge>;
      case 'TERMINATED':
        return <Badge variant="destructive">Terminated</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Auto-fill rent and deposit when unit is selected
  const handleUnitChange = (val: string) => {
    const selectedUnitId = parseInt(val);
    const u = units.find((unit) => unit.id === selectedUnitId);
    if (u) {
      setNewLease((prev) => ({
        ...prev,
        unitId: val,
        rentAmount: u.monthlyRent,
        depositAmount: u.depositAmount,
      }));
    } else {
      setNewLease((prev) => ({ ...prev, unitId: val }));
    }
  };

  // Filtered leases
  const filteredLeases = leases.filter((l) => {
    const tenantName = getTenantName(l.tenantId).toLowerCase();
    const unitName = getUnitName(l.unitId).toLowerCase();
    const leaseNo = l.leaseNumber?.toLowerCase() || '';
    const q = searchQuery.toLowerCase();
    return tenantName.includes(q) || unitName.includes(q) || leaseNo.includes(q);
  });

  const vacantUnits = units.filter((u) => u.status === 'VACANT');

  return (
    <AppLayout title="Leases & Agreements">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search leases by tenant, property, number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => setIsAddTenantOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Quick Add Tenant
            </Button>
            <Button onClick={() => setIsAddLeaseOpen(true)} disabled={vacantUnits.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              Create Lease
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Rental Agreements</CardTitle>
            <CardDescription>
              View and manage active, expired, or terminated lease agreements.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lease #</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Property / Unit</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Rent Rate</TableHead>
                  <TableHead>Next Invoice</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeases.map((lease) => (
                  <TableRow key={lease.id}>
                    <TableCell className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {lease.leaseNumber}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-indigo-500" />
                        <span className="font-medium">{getTenantName(lease.tenantId)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getUnitName(lease.unitId)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {format(new Date(lease.startDate), 'dd MMM yyyy')} -{' '}
                          {format(new Date(lease.endDate), 'dd MMM yyyy')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      KES {lease.rentAmount.toLocaleString()}
                      <span className="text-[10px] text-muted-foreground font-normal block">
                        / {lease.billingFrequency.toLowerCase()}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      {lease.nextInvoiceDate ? format(new Date(lease.nextInvoiceDate), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell>{getLeaseStatusBadge(lease.status)}</TableCell>
                    <TableCell className="text-right">
                      {lease.status === 'ACTIVE' && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGenerateInvoice(lease)}
                            className="text-indigo-600 hover:bg-indigo-50 hover:text-indigo-750"
                          >
                            Generate Invoice
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => lease.id && handleTerminateLease(lease.id)}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            Terminate
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredLeases.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      No leases found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Quick Add Tenant Dialog */}
        <Dialog open={isAddTenantOpen} onOpenChange={setIsAddTenantOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Quick Add Tenant</DialogTitle>
              <DialogDescription>
                Add a new customer profile designated specifically as a Tenant.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="tName">Full Name *</Label>
                <Input
                  id="tName"
                  value={newTenant.name}
                  onChange={(e) => setNewTenant((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="E.g., David Kimani"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tId">ID Number / Passport</Label>
                <Input
                  id="tId"
                  value={newTenant.idNumber}
                  onChange={(e) => setNewTenant((prev) => ({ ...prev, idNumber: e.target.value }))}
                  placeholder="National ID"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tPhone">Phone Number</Label>
                <Input
                  id="tPhone"
                  value={newTenant.phone}
                  onChange={(e) => setNewTenant((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="0712345678"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tEmail">Email Address</Label>
                <Input
                  id="tEmail"
                  type="email"
                  value={newTenant.email}
                  onChange={(e) => setNewTenant((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="tenant@example.com"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddTenantOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTenant}>Add Tenant</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Lease Dialog */}
        <Dialog open={isAddLeaseOpen} onOpenChange={setIsAddLeaseOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Lease Agreement</DialogTitle>
              <DialogDescription>
                Link a tenant from the shared directory to a vacant unit.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5 flex flex-col">
                <Label htmlFor="leaseTenant">Select Tenant *</Label>
                <Popover open={isTenantPopoverOpen} onOpenChange={setIsTenantPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="leaseTenant"
                      variant="outline"
                      role="combobox"
                      aria-expanded={isTenantPopoverOpen}
                      className="w-full justify-between text-left font-normal"
                    >
                      {newLease.tenantId
                        ? (() => {
                            const t = tenants.find(tenant => tenant.id.toString() === newLease.tenantId);
                            return t ? `${t.name}${t.idNumber ? ` (ID: ${t.idNumber})` : ''}` : 'Search / Select Tenant';
                          })()
                        : 'Search / Select Tenant'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search tenants..." />
                      <CommandList>
                        <CommandEmpty>No tenants found.</CommandEmpty>
                        <CommandGroup>
                          {tenants.map((t) => (
                            <CommandItem
                              key={t.id}
                              value={t.name.toLowerCase()}
                              onSelect={() => {
                                setNewLease((prev) => ({ ...prev, tenantId: t.id.toString() }));
                                setIsTenantPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  t.id.toString() === newLease.tenantId ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {t.name} {t.idNumber ? `(ID: ${t.idNumber})` : ''}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="leaseUnit">Select Vacant Unit *</Label>
                <Popover open={isUnitPopoverOpen} onOpenChange={setIsUnitPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="leaseUnit"
                      variant="outline"
                      role="combobox"
                      aria-expanded={isUnitPopoverOpen}
                      className="w-full justify-between animate-none"
                    >
                      {newLease.unitId
                        ? (() => {
                            const u = vacantUnits.find(unit => unit.id?.toString() === newLease.unitId);
                            return u
                              ? `${getUnitName(u.id!)} (Rent: KES ${u.monthlyRent.toLocaleString()})`
                              : 'Select Unit...';
                          })()
                        : 'Select Unit...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search vacant units..." />
                      <CommandList>
                        <CommandEmpty>No vacant units found.</CommandEmpty>
                        <CommandGroup>
                          {vacantUnits.map((u) => {
                            const displayName = `${getUnitName(u.id!)} (Rent: KES ${u.monthlyRent.toLocaleString()})`;
                            return (
                              <CommandItem
                                key={u.id}
                                value={displayName.toLowerCase()}
                                onSelect={() => {
                                  handleUnitChange(u.id?.toString() || '');
                                  setIsUnitPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    u.id?.toString() === newLease.unitId ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {displayName}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="leaseStart">Start Date *</Label>
                  <Input
                    id="leaseStart"
                    type="date"
                    value={newLease.startDate}
                    onChange={(e) => setNewLease((prev) => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="leaseEnd">End Date *</Label>
                  <Input
                    id="leaseEnd"
                    type="date"
                    value={newLease.endDate}
                    onChange={(e) => setNewLease((prev) => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nextInvoiceDate">Invoicing Start Date</Label>
                  <Input
                    id="nextInvoiceDate"
                    type="date"
                    value={newLease.nextInvoiceDate}
                    onChange={(e) => setNewLease((prev) => ({ ...prev, nextInvoiceDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="leaseRent">Rent Amount (KES) *</Label>
                  <Input
                    id="leaseRent"
                    type="number"
                    value={newLease.rentAmount}
                    onChange={(e) => setNewLease((prev) => ({ ...prev, rentAmount: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="leaseDeposit">Security Deposit Paid</Label>
                  <Input
                    id="leaseDeposit"
                    type="number"
                    value={newLease.depositAmount}
                    onChange={(e) => setNewLease((prev) => ({ ...prev, depositAmount: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="leaseFreq">Billing Frequency</Label>
                <Select
                  value={newLease.billingFrequency}
                  onValueChange={(val) => setNewLease((prev) => ({ ...prev, billingFrequency: val }))}
                >
                  <SelectTrigger id="leaseFreq">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                    <SelectItem value="ANNUALLY">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddLeaseOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleLeaseSaveAndCheck}>Create Agreement</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm Invoice Generation Dialog */}
        <Dialog open={invoiceConfirmLease !== null} onOpenChange={(open) => !open && setInvoiceConfirmLease(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Confirm Invoice Generation
              </DialogTitle>
              <DialogDescription>
                Review the billing details before generating this invoice.
              </DialogDescription>
            </DialogHeader>
            {invoiceConfirmLease && (() => {
              const date = invoiceConfirmLease.nextInvoiceDate ? new Date(invoiceConfirmLease.nextInvoiceDate) : new Date(invoiceConfirmLease.startDate);
              const monthName = format(date, 'MMMM yyyy');
              let amount = invoiceConfirmLease.rentAmount;
              let freqText = 'Monthly';
              if (invoiceConfirmLease.billingFrequency === 'QUARTERLY') {
                amount = invoiceConfirmLease.rentAmount * 3;
                freqText = 'Quarterly';
              } else if (invoiceConfirmLease.billingFrequency === 'ANNUALLY') {
                amount = invoiceConfirmLease.rentAmount * 12;
                freqText = 'Annual';
              }
              return (
                <div className="space-y-4 py-3">
                  <div className="space-y-2">
                    <p className="text-sm">
                      You are about to generate a <span className="font-bold text-indigo-600 dark:text-indigo-400">{freqText}</span> rent invoice for:
                    </p>
                    <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border text-sm space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tenant:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {getTenantName(invoiceConfirmLease.tenantId)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Unit:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {getUnitName(invoiceConfirmLease.unitId)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Billing Period:</span>
                        <span className="font-semibold text-amber-600">
                          {monthName}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1.5 border-t border-dashed">
                        <span className="font-medium">Invoice Amount:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          KES {amount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Continuing will advance the next invoice date by the frequency period.
                  </p>
                </div>
              );
            })()}
            <DialogFooter className="flex sm:justify-between">
              <Button variant="outline" onClick={() => setInvoiceConfirmLease(null)}>
                Cancel & Close
              </Button>
              <Button onClick={handleConfirmGenerateInvoice} className="bg-indigo-650 hover:bg-indigo-800 text-white">
                Continue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );

  // Fallback for button execution
  function handleLeaseSaveAndCheck() {
    handleSaveLease();
  }
}
