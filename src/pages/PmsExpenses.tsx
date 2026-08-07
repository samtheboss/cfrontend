import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { Property, PropertyUnit } from '@/types/inventory';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import {
  CreditCard,
  Plus,
  Trash2,
  Search,
  Calendar,
  Building,
  User,
  Paperclip,
  Upload,
  AlertCircle,
  TrendingDown,
  ChevronsUpDown,
  Check,
} from 'lucide-react';
import { apiFetch, getBaseUrl } from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { PaymentDialog, PaymentDetails } from '@/components/payments/PaymentDialog';

interface Expense {
  id: any;
  date: string;
  categoryId: any;
  categoryName: string;
  description: string;
  propertyId?: any;
  unitId?: any;
  roomId?: any;
  roomNumber?: string;
  bookingId?: any;
  supplierId?: any;
  supplierName?: string;
  locationId?: string;
  amount: number;
  paymentMethod: string;
  referenceNumber: string;
  attachmentPath?: string;
  expenseType: string;
  createdBy?: string;
  createdAt?: string;
}

interface ExpenseCategory {
  id: any;
  name: string;
  description: string;
  isActive: boolean;
  isDefault: boolean;
}

export default function PmsExpenses() {
  const { suppliers } = useInventory();

  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<PropertyUnit[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isCategoryPopoverOpen, setIsCategoryPopoverOpen] = useState(false);
  const [isPropertyPopoverOpen, setIsPropertyPopoverOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<any>(null);

  // Form states
  const [newExpense, setNewExpense] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    categoryId: '',
    description: '',
    propertyId: '',
    unitId: '',
    supplierId: '',
    amount: 0,
    paymentMethod: 'CASH',
    referenceNumber: '',
    attachmentPath: '',
    expenseType: 'PROPERTY',
  });

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const propRes = await apiFetch<{ data: Property[] }>('/api/pms/properties');
      const unitRes = await apiFetch<{ data: PropertyUnit[] }>('/api/pms/units');
      const catsRes = await apiFetch<any[]>('/api/accounting/accounts');
      const expRes = await apiFetch<{ data: Expense[] }>('/api/expenses?type=PROPERTY');
      
      const expenseAccounts = (catsRes || [])
        .filter((a: any) => a.type === 'EXPENSE' && a.active)
        .map((a: any) => ({
          id: a.id,
          name: `${a.code} - ${a.name}`,
          description: a.description || '',
          isActive: a.active,
          isDefault: false
        }));

      setProperties(propRes.data || []);
      setUnits(unitRes.data || []);
      setCategories(expenseAccounts);
      setExpenses(expRes.data || []);
    } catch (err: any) {
      toast.error('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Save Expense
  const handleSaveExpense = async () => {
    if (!newExpense.propertyId || !newExpense.categoryId || newExpense.amount <= 0) {
      toast.error('Please complete property, category, and enter an amount');
      return;
    }

    const selectedCategory = categories.find((c) => c.id.toString() === newExpense.categoryId);
    const selectedSupplier = suppliers.find((s) => s.id === newExpense.supplierId);
    
    const payload = {
      ...newExpense,
      categoryId: parseInt(newExpense.categoryId),
      propertyId: parseInt(newExpense.propertyId),
      unitId: newExpense.unitId ? parseInt(newExpense.unitId) : null,
      supplierId: newExpense.supplierId ? parseInt(newExpense.supplierId) : null,
      supplierName: selectedSupplier ? selectedSupplier.name : '',
      categoryName: selectedCategory ? selectedCategory.name : '',
      amount: parseFloat(newExpense.amount as any),
      createdBy: 'System',
    };

    setPendingPayload(payload);
    setIsPaymentDialogOpen(true);
  };

  const handleConfirmPayment = async (paymentsList: PaymentDetails[]) => {
    if (!pendingPayload || paymentsList.length === 0) return;

    try {
      const backendPaymentLines = paymentsList
        .filter(p => p.amount > 0)
        .map(p => {
          let method = p.method.toUpperCase();
          if (method === 'MOBILE') method = 'MOBILE_MONEY';
          return {
            method: method,
            amount: p.amount,
            reference: p.reference || '',
            accountId: p.glAccountId || null,
          };
        });

      if (backendPaymentLines.length === 0) {
        toast.error('Please record a valid payment');
        return;
      }

      const firstActive = backendPaymentLines[0];

      const finalPayload = {
        ...pendingPayload,
        paymentMethod: firstActive.method,
        referenceNumber: firstActive.reference,
        glAccountId: firstActive.accountId,
        paymentLines: backendPaymentLines,
      };

      await apiFetch('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(finalPayload),
      });

      toast.success('Property expense logged successfully');
      setIsPaymentDialogOpen(false);
      setIsAddExpenseOpen(false);
      setPendingPayload(null);
      setNewExpense({
        date: format(new Date(), 'yyyy-MM-dd'),
        categoryId: '',
        description: '',
        propertyId: '',
        unitId: '',
        supplierId: '',
        amount: 0,
        paymentMethod: 'CASH',
        referenceNumber: '',
        attachmentPath: '',
        expenseType: 'PROPERTY',
      });
      fetchData();
    } catch (err: any) {
      toast.error('Failed to save expense: ' + err.message);
    }
  };

  // Handle Delete Expense
  const handleDeleteExpense = async (id: number) => {
    if (!confirm('Are you sure you want to delete this expense record?')) return;

    try {
      await apiFetch(`/api/expenses/${id}`, { method: 'DELETE' });
      toast.success('Expense deleted');
      fetchData();
    } catch (err: any) {
      toast.error('Failed to delete expense: ' + err.message);
    }
  };

  // Handle Attachment Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await apiFetch<{ data: string }>('/api/expenses/upload', {
        method: 'POST',
        body: formData,
      });
      setNewExpense((prev) => ({ ...prev, attachmentPath: res.data }));
      toast.success('File uploaded successfully');
    } catch (err: any) {
      toast.error('Failed to upload file: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  // Helpers
  const getPropertyName = (id?: number) => {
    if (!id) return 'General';
    const prop = properties.find((p) => p.id === id);
    return prop ? prop.name : `Property #${id}`;
  };

  const getUnitName = (id?: number) => {
    if (!id) return '';
    const u = units.find((unit) => unit.id === id);
    return u ? `Unit ${u.unitNumber}` : '';
  };

  // Filtered properties/units
  const availableUnits = units.filter(
    (u) => u.propertyId.toString() === newExpense.propertyId
  );

  // Filtered expenses list
  const filteredExpenses = expenses.filter((exp) => {
    const propName = getPropertyName(exp.propertyId).toLowerCase();
    const unitNo = getUnitName(exp.unitId).toLowerCase();
    const catName = exp.categoryName.toLowerCase();
    const desc = exp.description?.toLowerCase() || '';
    const q = searchQuery.toLowerCase();
    return propName.includes(q) || unitNo.includes(q) || catName.includes(q) || desc.includes(q);
  });

  return (
    <AppLayout title="Property Expenses">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search expenses by property, unit, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setIsAddExpenseOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Log Expense
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Expense Register</CardTitle>
            <CardDescription>
              Record maintenance, cleaning, repairs, and operational costs.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Property / Unit</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Receipt / File</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((exp) => (
                  <TableRow key={exp.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(exp.date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold">{getPropertyName(exp.propertyId)}</p>
                      {exp.unitId && <p className="text-xs text-muted-foreground">{getUnitName(exp.unitId)}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{exp.categoryName}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-slate-650 dark:text-slate-350">
                      {exp.description}
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900 dark:text-white">
                      KES {exp.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs">{exp.paymentMethod}</TableCell>
                    <TableCell>
                      {exp.attachmentPath ? (
                        <a
                          href={`${getBaseUrl()}/${exp.attachmentPath}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                        >
                          <Paperclip className="h-3 w-3" />
                          View Receipt
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredExpenses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      No expenses found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Log Expense Dialog */}
        <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Property Expense</DialogTitle>
              <DialogDescription>
                Record operational or maintenance costs for properties/units.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="expDate">Expense Date *</Label>
                  <Input
                    id="expDate"
                    type="date"
                    value={newExpense.date}
                    onChange={(e) => setNewExpense((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expCat">Category *</Label>
                  <Popover open={isCategoryPopoverOpen} onOpenChange={setIsCategoryPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="expCat"
                        variant="outline"
                        role="combobox"
                        aria-expanded={isCategoryPopoverOpen}
                        className="w-full justify-between"
                      >
                        {newExpense.categoryId
                          ? categories.find(c => c.id.toString() === newExpense.categoryId)?.name
                          : 'Select Category...'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search categories..." />
                        <CommandList>
                          <CommandEmpty>No categories found.</CommandEmpty>
                          <CommandGroup>
                            {categories.map((cat) => (
                              <CommandItem
                                key={cat.id}
                                value={cat.name}
                                onSelect={() => {
                                  setNewExpense((prev) => ({ ...prev, categoryId: cat.id.toString() }));
                                  setIsCategoryPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    cat.id.toString() === newExpense.categoryId ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {cat.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="expProp">Property *</Label>
                  <Popover open={isPropertyPopoverOpen} onOpenChange={setIsPropertyPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="expProp"
                        variant="outline"
                        role="combobox"
                        aria-expanded={isPropertyPopoverOpen}
                        className="w-full justify-between"
                      >
                        {newExpense.propertyId
                          ? properties.find(p => p.id?.toString() === newExpense.propertyId)?.name
                          : 'Select Property...'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search properties..." />
                        <CommandList>
                          <CommandEmpty>No properties found.</CommandEmpty>
                          <CommandGroup>
                            {properties.map((prop) => (
                              <CommandItem
                                key={prop.id}
                                value={prop.name}
                                onSelect={() => {
                                  setNewExpense((prev) => ({ ...prev, propertyId: prop.id?.toString() || '', unitId: '' }));
                                  setIsPropertyPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    prop.id?.toString() === newExpense.propertyId ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {prop.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expUnit">Unit (Optional)</Label>
                  <Select
                    value={newExpense.unitId}
                    onValueChange={(val) => setNewExpense((prev) => ({ ...prev, unitId: val }))}
                    disabled={!newExpense.propertyId}
                  >
                    <SelectTrigger id="expUnit">
                      <SelectValue placeholder="Select Unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUnits.map((u) => (
                        <SelectItem key={u.id} value={u.id?.toString() || ''}>
                          Unit {u.unitNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="expAmount">Amount (KES) *</Label>
                  <Input
                    id="expAmount"
                    type="number"
                    value={newExpense.amount}
                    onChange={(e) =>
                      setNewExpense((prev) => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expSupplier">Supplier (Optional)</Label>
                  <Select
                    value={newExpense.supplierId}
                    onValueChange={(val) => setNewExpense((prev) => ({ ...prev, supplierId: val }))}
                  >
                    <SelectTrigger id="expSupplier">
                      <SelectValue placeholder="Select Supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>



              <div className="space-y-1.5">
                <Label htmlFor="expDesc">Description / Memo</Label>
                <Input
                  id="expDesc"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expFile">Attachment / Receipt</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="expFile"
                    type="file"
                    onChange={handleFileUpload}
                    className="cursor-pointer"
                  />
                  {uploading && <span className="text-xs text-muted-foreground animate-pulse">Uploading...</span>}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddExpenseOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveExpense}>Log Expense</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payment Popup Dialog */}
        <PaymentDialog
          module="PMS_EXPENSE"
          open={isPaymentDialogOpen}
          onOpenChange={setIsPaymentDialogOpen}
          title="Expense Payment Details"
          description={`Select the payment method and target asset account for the expense of KES ${newExpense.amount}.`}
          totalDue={newExpense.amount}
          onSubmit={handleConfirmPayment}
          allowPartialPayment={false}
        />
      </div>
    </AppLayout>
  );
}
