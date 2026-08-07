import { useState, useMemo, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Search,
  Plus,
  Trash2,
  DollarSign,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Calendar,
  Building,
  Tag,
  Receipt,
  Eye,
  Paperclip,
  Upload,
  ChevronsUpDown,
  Check
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { format } from 'date-fns';
import { apiFetch, getBaseUrl } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { PaymentDialog, PaymentDetails } from '@/components/payments/PaymentDialog';

interface Expense {
  id: any;
  date: string;
  categoryId: any;
  categoryName: string;
  description: string;
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
  expenseType: 'INVENTORY' | 'GENERAL';
  transactionJournalNumber?: string;
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

interface Room {
  id: any;
  roomNumber: string;
  type: string;
}

interface ApiResponse<T> {
  title: string;
  message: string;
  data: T;
}

export default function AccommodationExpenses() {
  const { user } = useAuth();
  const { suppliers } = useInventory();
  const [activeTab, setActiveTab] = useState('expenses');

  // --- States ---
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterRoom, setFilterRoom] = useState('All');
  const [filterType, setFilterType] = useState('All');

  // Add Expense Dialog
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    categoryId: '',
    description: '',
    roomId: 'none',
    supplierId: 'none',
    amount: '',
    paymentMethod: 'CASH',
    referenceNumber: '',
    attachmentPath: '',
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<any>(null);
  const [isCategoryPopoverOpen, setIsCategoryPopoverOpen] = useState(false);

  // Add Category Dialog
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const catsRes = await apiFetch<any[]>('/api/accounting/accounts');
      const expenseAccounts = (catsRes || [])
        .filter((a: any) => a.type === 'EXPENSE' && a.active)
        .map((a: any) => ({
          id: a.id,
          name: `${a.code} - ${a.name}`,
          description: a.description || '',
          isActive: a.active,
          isDefault: false
        }));
      setCategories(expenseAccounts);

      const roomsRes = await apiFetch<ApiResponse<Room[]>>('/api/accommodation/rooms');
      setRooms(roomsRes.data || []);

      const expRes = await apiFetch<ApiResponse<Expense[]>>('/api/expenses');
      setExpenses(expRes.data || []);
    } catch (err: any) {
      toast.error('Failed to load data: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchesSearch = 
        e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.roomNumber && e.roomNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.categoryName && e.categoryName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.referenceNumber && e.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.supplierName && e.supplierName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesDate = 
        (!filterStartDate || e.date >= filterStartDate) &&
        (!filterEndDate || e.date <= filterEndDate);

      const matchesCategory = filterCategory === 'All' || String(e.categoryId) === filterCategory;
      const matchesRoom = filterRoom === 'All' || String(e.roomId) === filterRoom;
      const matchesType = filterType === 'All' || e.expenseType === filterType;

      return matchesSearch && matchesDate && matchesCategory && matchesRoom && matchesType;
    });
  }, [expenses, searchQuery, filterStartDate, filterEndDate, filterCategory, filterRoom, filterType]);

  // Statistics
  const stats = useMemo(() => {
    let total = 0;
    let inventoryCost = 0;
    let generalCost = 0;
    
    filteredExpenses.forEach(e => {
      total += e.amount;
      if (e.expenseType === 'INVENTORY') {
        inventoryCost += e.amount;
      } else {
        generalCost += e.amount;
      }
    });

    return { total, inventoryCost, generalCost };
  }, [filteredExpenses]);

  // Handle Save Expense
  const handleSaveExpense = async () => {
    if (!expenseForm.categoryId || !expenseForm.amount || parseFloat(expenseForm.amount) <= 0) {
      toast.error('Please specify category and dynamic positive amount');
      return;
    }

    const categoryObj = categories.find(c => String(c.id) === String(expenseForm.categoryId));
    const roomObj = rooms.find(r => String(r.id) === String(expenseForm.roomId));
    const supplierObj = suppliers.find(s => String(s.id) === String(expenseForm.supplierId));

    const payload = {
      date: expenseForm.date,
      categoryId: Number(expenseForm.categoryId),
      categoryName: categoryObj ? categoryObj.name : '',
      description: expenseForm.description,
      roomId: expenseForm.roomId !== 'none' ? Number(expenseForm.roomId) : null,
      roomNumber: expenseForm.roomId !== 'none' && roomObj ? roomObj.roomNumber : null,
      supplierId: expenseForm.supplierId !== 'none' ? Number(expenseForm.supplierId) : null,
      supplierName: expenseForm.supplierId !== 'none' && supplierObj ? supplierObj.name : null,
      amount: parseFloat(expenseForm.amount),
      paymentMethod: expenseForm.paymentMethod,
      referenceNumber: expenseForm.referenceNumber,
      attachmentPath: expenseForm.attachmentPath,
      expenseType: 'GENERAL', // UI posts general expenses
      createdBy: user?.name || user?.username || 'System',
      approvedBy: user?.name || user?.username || 'System',
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

      toast.success('Expense recorded successfully');
      setIsPaymentDialogOpen(false);
      setIsExpenseDialogOpen(false);
      setPendingPayload(null);
      setExpenseForm({
        date: format(new Date(), 'yyyy-MM-dd'),
        categoryId: '',
        description: '',
        roomId: 'none',
        supplierId: 'none',
        amount: '',
        paymentMethod: 'CASH',
        referenceNumber: '',
        attachmentPath: '',
      });
      fetchData();
    } catch (err: any) {
      toast.error('Failed to save expense: ' + err.message);
    }
  };

  // Handle File Attachment Upload
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await apiFetch<ApiResponse<string>>('/api/expenses/upload', {
        method: 'POST',
        body: formData,
      });
      setExpenseForm(prev => ({ ...prev, attachmentPath: res.data }));
      toast.success('Attachment uploaded successfully');
    } catch (err: any) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Create Category
  const handleCreateCategory = async () => {
    if (!categoryForm.name) return;
    try {
      await apiFetch('/api/expenses/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: categoryForm.name,
          description: categoryForm.description,
          isActive: true,
          createdBy: user?.name || user?.username || 'System',
        }),
      });
      toast.success('Category created successfully');
      setIsCategoryDialogOpen(false);
      setCategoryForm({ name: '', description: '' });
      fetchData();
    } catch (err: any) {
      toast.error('Failed to create category: ' + err.message);
    }
  };

  // Delete Category
  const handleDeleteCategory = async (id: number) => {
    if (confirm('Are you sure you want to delete this category?')) {
      try {
        await apiFetch(`/api/expenses/categories/${id}`, {
          method: 'DELETE',
        });
        toast.success('Category deleted');
        fetchData();
      } catch (err: any) {
        toast.error(err.message);
      }
    }
  };

  // Delete Expense
  const handleDeleteExpense = async (id: number) => {
    if (confirm('Are you sure you want to delete this expense record?')) {
      try {
        await apiFetch(`/api/expenses/${id}`, {
          method: 'DELETE',
        });
        toast.success('Expense record deleted');
        fetchData();
      } catch (err: any) {
        toast.error('Failed to delete expense: ' + err.message);
      }
    }
  };

  return (
    <AppLayout title="Accommodation Operating Expenses">
      <div className="space-y-6">
        {/* Main Tab Controller */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                {activeTab === 'expenses' && 'Operating Expenses'}
                {activeTab === 'categories' && 'Expense Categories'}
                {activeTab === 'logs' && 'Room Inventory Consumption Logs'}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {activeTab === 'expenses' && 'Manage internet, utilities, repairs, laundry, and staff expenses'}
                {activeTab === 'categories' && 'Configure custom dynamic expense categories'}
                {activeTab === 'logs' && 'Auto-generated logs of consumables used on guest room check-ins'}
              </p>
            </div>

            <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex gap-1">
              <TabsTrigger value="expenses" className="rounded-lg px-4 py-2 text-xs font-semibold shrink-0">Expenses</TabsTrigger>
              <TabsTrigger value="categories" className="rounded-lg px-4 py-2 text-xs font-semibold shrink-0">Categories</TabsTrigger>
              <TabsTrigger value="logs" className="rounded-lg px-4 py-2 text-xs font-semibold shrink-0">Consumption Logs</TabsTrigger>
            </TabsList>
          </div>

          {/* ==================== TAB 1: EXPENSES ==================== */}
          <TabsContent value="expenses" className="space-y-6 mt-4">
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white dark:bg-slate-900 p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Expenses</p>
                  <p className="text-2xl font-black text-slate-850 dark:text-slate-100 mt-2">
                    KES {stats.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-600">
                  <DollarSign className="h-6 w-6" />
                </div>
              </Card>

              <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white dark:bg-slate-900 p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">General Operating Expenses</p>
                  <p className="text-2xl font-black text-slate-850 dark:text-slate-100 mt-2">
                    KES {stats.generalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-600">
                  <Receipt className="h-6 w-6" />
                </div>
              </Card>

              <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white dark:bg-slate-900 p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inventory Room Consumption Cost</p>
                  <p className="text-2xl font-black text-slate-850 dark:text-slate-100 mt-2">
                    KES {stats.inventoryCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600">
                  <Tag className="h-6 w-6" />
                </div>
              </Card>
            </div>

            {/* Filter controls */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search expenses..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 bg-white dark:bg-slate-950 border-slate-200 rounded-xl h-10 text-xs"
                  />
                </div>

                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[150px] bg-white dark:bg-slate-950 border-slate-200 rounded-xl h-10 text-xs">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Categories</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterRoom} onValueChange={setFilterRoom}>
                  <SelectTrigger className="w-[140px] bg-white dark:bg-slate-950 border-slate-200 rounded-xl h-10 text-xs">
                    <SelectValue placeholder="All Rooms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Rooms</SelectItem>
                    {rooms.map(r => (
                      <SelectItem key={r.id} value={String(r.id)}>Room {r.roomNumber}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[140px] bg-white dark:bg-slate-950 border-slate-200 rounded-xl h-10 text-xs">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Types</SelectItem>
                    <SelectItem value="GENERAL">GENERAL</SelectItem>
                    <SelectItem value="INVENTORY">INVENTORY</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-250 p-1 px-3 rounded-xl text-xs font-semibold">
                  <span className="text-slate-400">Date:</span>
                  <Input
                    type="date"
                    value={filterStartDate}
                    onChange={e => setFilterStartDate(e.target.value)}
                    className="h-7 w-28 bg-transparent border-none p-0 text-xs font-semibold focus-visible:ring-0"
                  />
                  <span className="text-slate-400">to</span>
                  <Input
                    type="date"
                    value={filterEndDate}
                    onChange={e => setFilterEndDate(e.target.value)}
                    className="h-7 w-28 bg-transparent border-none p-0 text-xs font-semibold focus-visible:ring-0"
                  />
                </div>
              </div>

              <Button onClick={() => setIsExpenseDialogOpen(true)} className="bg-primary hover:bg-primary/95 text-white font-medium px-5 rounded-xl shadow-md h-10 text-xs">
                <Plus className="h-4 w-4 mr-2" /> Record Expense
              </Button>
            </div>

            {/* Expenses Table */}
            <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white dark:bg-slate-900 overflow-hidden">
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-950/40">
                      <TableHead className="font-bold text-xs uppercase text-slate-500">DATE</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-500">CATEGORY</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-500">ROOM</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-500">DESCRIPTION</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-500">METHOD</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-500">REF CODE</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-500 text-right">AMOUNT (KES)</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-500">TYPE</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map(e => (
                      <TableRow key={e.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-semibold text-slate-600 dark:text-slate-350">{e.date}</TableCell>
                        <TableCell className="font-bold text-slate-800 dark:text-slate-100">{e.categoryName}</TableCell>
                        <TableCell className="font-bold text-slate-700 dark:text-slate-300">
                          {e.roomNumber ? `Room ${e.roomNumber}` : '-'}
                        </TableCell>
                        <TableCell className="text-slate-550 max-w-[250px] truncate">{e.description}</TableCell>
                        <TableCell className="text-slate-500 font-medium">{e.paymentMethod}</TableCell>
                        <TableCell className="text-slate-500 font-mono text-[11px]">{e.referenceNumber || '-'}</TableCell>
                        <TableCell className="text-right font-black text-slate-800 dark:text-slate-205">
                          {e.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "px-2 py-0.5 text-[9px] font-bold rounded-lg border uppercase",
                            e.expenseType === 'INVENTORY' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200"
                          )}>
                            {e.expenseType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right flex items-center justify-end gap-1">
                          {e.attachmentPath && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0" 
                              onClick={() => window.open(`${getBaseUrl()}/${e.attachmentPath}`, '_blank')}
                            >
                              <Paperclip className="h-4 w-4 text-slate-400 hover:text-slate-655" />
                            </Button>
                          )}
                          {e.expenseType !== 'INVENTORY' && (
                            <Button variant="ghost" className="h-8 text-rose-500 hover:bg-rose-50 px-2" onClick={() => handleDeleteExpense(e.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredExpenses.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="h-32 text-center text-slate-400">
                          No expense logs matching configuration found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== TAB 2: CATEGORIES ==================== */}
          <TabsContent value="categories" className="space-y-6 mt-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Dynamic Expense Categories</h3>
                <p className="text-xs text-slate-550 mt-0.5">Manage classification categories for booking operation expenses.</p>
              </div>
              <Button onClick={() => setIsCategoryDialogOpen(true)} className="bg-primary hover:bg-primary/95 text-white font-medium px-4 rounded-xl shadow-md h-10 text-xs">
                <Plus className="h-4 w-4 mr-1.5" /> Add Category
              </Button>
            </div>

            <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white dark:bg-slate-900 overflow-hidden">
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-950/40">
                      <TableHead className="font-bold text-xs uppercase text-slate-500">CATEGORY NAME</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-500">DESCRIPTION</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-500">SYSTEM DEFAULT</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map(cat => (
                      <TableRow key={cat.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-bold text-slate-800 dark:text-slate-100">{cat.name}</TableCell>
                        <TableCell className="text-slate-500">{cat.description}</TableCell>
                        <TableCell>
                          {cat.isDefault ? (
                            <Badge className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[9px] font-bold rounded-lg uppercase">System Default</Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-450 border-slate-205 px-2 py-0.5 text-[9px] font-bold rounded-lg uppercase">Custom</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!cat.isDefault && (
                            <Button variant="ghost" className="h-8 text-rose-500 hover:bg-rose-50 px-2" onClick={() => handleDeleteCategory(cat.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== TAB 3: CONSUMPTION LOGS ==================== */}
          <TabsContent value="logs" className="space-y-6 mt-4">
            <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white dark:bg-slate-900 overflow-hidden">
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-950/40">
                      <TableHead className="font-bold text-xs uppercase text-slate-550">DATE</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-550">ROOM</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-550">JOURNAL NO</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-550">DESCRIPTION</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-slate-550 text-right">TOTAL COST (KES)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses
                      .filter(e => e.expenseType === 'INVENTORY')
                      .map(e => (
                        <TableRow key={e.id} className="hover:bg-slate-50/50">
                          <TableCell className="font-semibold text-slate-600 dark:text-slate-350">{e.date}</TableCell>
                          <TableCell className="font-bold text-slate-800 dark:text-slate-100">
                            {e.roomNumber ? `Room ${e.roomNumber}` : '-'}
                          </TableCell>
                          <TableCell className="font-mono text-xs font-bold text-primary">{e.transactionJournalNumber || '-'}</TableCell>
                          <TableCell className="text-slate-500 font-medium">{e.description}</TableCell>
                          <TableCell className="text-right font-black text-emerald-650">
                            KES {e.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    {expenses.filter(e => e.expenseType === 'INVENTORY').length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="h-32 text-center text-slate-400">
                          No stock consumption transactions logged yet. Check in a room with allocated consumables.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ==================== MODAL: ADD EXPENSE ==================== */}
      <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl bg-white dark:bg-slate-900 border shadow-2xl overflow-y-auto max-h-[85vh] p-6">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-lg font-bold text-slate-850 dark:text-slate-100">Record General Expense</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">Specify custom amount and payment reference details.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-555 uppercase">Expense Date *</Label>
              <Input
                type="date"
                value={expenseForm.date}
                onChange={e => setExpenseForm(prev => ({ ...prev, date: e.target.value }))}
                className="rounded-xl h-10 text-xs"
              />
            </div>

            <div className="space-y-1.5 flex flex-col">
              <Label className="text-xs font-bold text-slate-555 uppercase">Expense Category *</Label>
              <Popover open={isCategoryPopoverOpen} onOpenChange={setIsCategoryPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isCategoryPopoverOpen}
                    className="w-full justify-between rounded-xl h-10 text-xs font-normal border-slate-200"
                  >
                    {expenseForm.categoryId
                      ? categories.find(c => String(c.id) === String(expenseForm.categoryId))?.name
                      : 'Select category...'}
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
                              setExpenseForm((prev) => ({ ...prev, categoryId: String(cat.id) }));
                              setIsCategoryPopoverOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                String(cat.id) === String(expenseForm.categoryId) ? "opacity-100" : "opacity-0"
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

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-555 uppercase">Associated Guest Room (Optional)</Label>
              <Select 
                value={expenseForm.roomId} 
                onValueChange={val => setExpenseForm(prev => ({ ...prev, roomId: val }))}
              >
                <SelectTrigger className="rounded-xl h-10 text-xs">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None / Central</SelectItem>
                  {rooms.map(r => (
                    <SelectItem key={r.id} value={String(r.id)}>Room {r.roomNumber} ({r.type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-555 uppercase">Supplier (Optional)</Label>
              <Select 
                value={expenseForm.supplierId} 
                onValueChange={val => setExpenseForm(prev => ({ ...prev, supplierId: val }))}
              >
                <SelectTrigger className="rounded-xl h-10 text-xs">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None / External</SelectItem>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-555 uppercase">Amount Paid (KES) *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">KES</span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={expenseForm.amount}
                  onChange={e => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="pl-11 rounded-xl h-10 text-xs"
                />
              </div>
            </div>



            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs font-bold text-slate-555 uppercase">Description spec</Label>
              <textarea
                placeholder="Provide notes/purpose details of this expenditure..."
                value={expenseForm.description}
                onChange={e => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full min-h-[70px] rounded-xl border border-slate-205 p-3 text-xs focus:outline-none dark:bg-slate-950 focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label className="text-xs font-bold text-slate-555 uppercase">Attachment (Receipt / Invoice)</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  id="receipt-file"
                  className="hidden"
                  onChange={e => e.target.files && handleFileUpload(e.target.files[0])}
                  disabled={isUploading}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="border-dashed border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl h-10 gap-2 flex-1 text-xs"
                  onClick={() => document.getElementById('receipt-file')?.click()}
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4 text-slate-400" />
                  {isUploading ? 'Uploading...' : expenseForm.attachmentPath ? 'Replace Attachment' : 'Upload Receipt File'}
                </Button>
                {expenseForm.attachmentPath && (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1.5 h-10 rounded-xl px-3 text-xs">
                    <Receipt className="h-3.5 w-3.5" /> File Linked
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsExpenseDialogOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSaveExpense} className="bg-primary hover:bg-primary/95 text-white rounded-xl font-semibold">
              Record Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== MODAL: ADD CATEGORY ==================== */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-slate-900 border shadow-2xl p-6">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-lg font-bold text-slate-850 dark:text-slate-100">Add Dynamic Category</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-555 uppercase">Category Name *</Label>
              <Input
                placeholder="e.g. Wi-Fi internet"
                value={categoryForm.name}
                onChange={e => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                className="rounded-xl h-10 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-555 uppercase">Description</Label>
              <textarea
                placeholder="Summary context info..."
                value={categoryForm.description}
                onChange={e => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full min-h-[70px] rounded-xl border border-slate-205 p-3 text-xs focus:outline-none dark:bg-slate-950 focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleCreateCategory} className="bg-primary hover:bg-primary/95 text-white rounded-xl font-semibold" disabled={!categoryForm.name}>
              Create Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Popup Dialog */}
      <PaymentDialog
        module="ACCOMMODATION_EXPENSE"
        open={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        title="Expense Payment Details"
        description={`Select the payment method and target asset account for the expense of KES ${expenseForm.amount}.`}
        totalDue={parseFloat(expenseForm.amount) || 0}
        onSubmit={handleConfirmPayment}
        allowPartialPayment={false}
      />
    </AppLayout>
  );
}
