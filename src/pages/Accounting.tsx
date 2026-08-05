import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  BarChart3,
  FileText,
  Settings2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  Search,
  RefreshCw,
  ChevronsUpDown,
  Check
} from 'lucide-react';

// ── Types ──
interface GlAccount {
  id: number;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  parentId: number | null;
  description: string;
  active: boolean;
  isDefault: boolean;
  paymentMethod: string | null;
}

interface AccountMapping {
  id: number;
  transactionType: string;
  debitAccount: GlAccount | null;
  creditAccount: GlAccount | null;
  description: string;
}

interface GlJournal {
  id: number;
  journalNumber: string;
  date: string;
  reference: string;
  description: string;
  sourceModule: string;
  sourceTransactionId: number | null;
  status: string;
  createdBy: string;
  entries: GlJournalEntry[];
}

interface GlJournalEntry {
  id: number;
  debitAccount: GlAccount;
  creditAccount: GlAccount;
  amount: number;
  description: string;
}

interface TrialBalanceRow {
  accountId: number;
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
  balance: number;
}

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];
const PAYMENT_METHODS = ['CASH', 'BANK', 'MOBILE_MONEY'];
const TRANSACTION_TYPES = [
  'SALE', 'SALE_CASH', 'PURCHASE', 'CUSTOMER_RECEIPT', 'SUPPLIER_PAYMENT',
  'RENTAL_INVOICE', 'RENTAL_PAYMENT', 'ACCOMMODATION_INVOICE', 'ACCOMMODATION_PAYMENT',
  'ACCOMMODATION_EXPENSE', 'STOCK_ADJUSTMENT', 'SALE_RETURN', 'COST_OF_SALES',
  'VAT_OUTPUT', 'VAT_INPUT'
];

const fmt = (n: number) => new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function SearchableAccountSelect({
  value,
  onChange,
  accounts,
  placeholder
}: {
  value: string;
  onChange: (val: string) => void;
  accounts: GlAccount[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedAccount = accounts.find(a => String(a.id) === String(value));

  const filteredAccounts = accounts.filter(a =>
    a.code.toLowerCase().includes(search.toLowerCase()) ||
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-9 px-3 text-xs"
        >
          <span className="truncate">
            {selectedAccount ? `${selectedAccount.code} - ${selectedAccount.name}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 z-[10000]">
        <div className="flex flex-col">
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder="Search account..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-7 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filteredAccounts.length === 0 && (
              <div className="py-2 text-center text-xs text-muted-foreground">No accounts found.</div>
            )}
            {filteredAccounts.map((a) => (
              <button
                key={a.id}
                type="button"
                className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  onChange(String(a.id));
                  setOpen(false);
                  setSearch('');
                }}
              >
                <span className="truncate">{a.code} - {a.name}</span>
                {String(a.id) === String(value) && <Check className="h-3 w-3 text-primary shrink-0 ml-2" />}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function Accounting() {
  // ── Shared state ──
  const [accounts, setAccounts] = useState<GlAccount[]>([]);
  const [mappings, setMappings] = useState<AccountMapping[]>([]);
  const [journals, setJournals] = useState<GlJournal[]>([]);
  const [loading, setLoading] = useState(false);
  
  // ── Unposted state ──
  const [unpostedTxs, setUnpostedTxs] = useState<any[]>([]);
  const [unpostedPurchases, setUnpostedPurchases] = useState<any[]>([]);
  const [loadingUnposted, setLoadingUnposted] = useState(false);

  // ── Report state ──
  const [reportTab, setReportTab] = useState('trial-balance');
  const [reportStart, setReportStart] = useState(() => {
    const d = new Date(); d.setMonth(0); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [reportEnd, setReportEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [trialBalance, setTrialBalance] = useState<TrialBalanceRow[]>([]);
  const [profitLoss, setProfitLoss] = useState<any>(null);
  const [balanceSheet, setBalanceSheet] = useState<any>(null);

  // ── Account dialog state ──
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<GlAccount | null>(null);
  const [accountForm, setAccountForm] = useState({ code: '', name: '', type: 'ASSET' as any, description: '', active: true, isDefault: false, paymentMethod: '' as string });

  // ── Mapping dialog state ──
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<AccountMapping | null>(null);
  const [mappingForm, setMappingForm] = useState({ transactionType: '', debitAccountId: '', creditAccountId: '', description: '' });

  // ── Manual journal dialog state ──
  const [journalDialogOpen, setJournalDialogOpen] = useState(false);
  const [journalForm, setJournalForm] = useState({ reference: '', description: '', entries: [{ accountId: '', debit: '', credit: '', description: '' }] });

  // ── Search ──
  const [accountSearch, setAccountSearch] = useState('');
  const [journalSearch, setJournalSearch] = useState('');

  // ── GL date filter & details state ──
  const [journalStart, setJournalStart] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); // default to 1 month ago
    return d.toISOString().slice(0, 10);
  });
  const [journalEnd, setJournalEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedJournalDetails, setSelectedJournalDetails] = useState<GlJournal | null>(null);

  // ── Ledger detail modal state ──
  const [selectedLedgerAccount, setSelectedLedgerAccount] = useState<{ id: number; name: string; code: string } | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [loadingLedger, setLoadingLedger] = useState(false);

  async function fetchLedgerEntries(accountId: number, code: string, name: string) {
    setSelectedLedgerAccount({ id: accountId, code, name });
    setLoadingLedger(true);
    setIsLedgerModalOpen(true);
    try {
      const isoStart = reportStart ? `${reportStart}T00:00:00` : '2026-01-01T00:00:00';
      const isoEnd = reportEnd ? `${reportEnd}T23:59:59` : '2026-12-31T23:59:59';
      
      const res = await apiFetch<any>(`/api/accounting/reports/general-ledger/${accountId}?start=${isoStart}&end=${isoEnd}`);
      setLedgerEntries(res?.entries || []);
    } catch (err: any) {
      toast.error('Failed to load transaction details: ' + err.message);
    } finally {
      setLoadingLedger(false);
    }
  }

  // ── Data fetching ──
  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    fetchJournals();
  }, [journalStart, journalEnd]);

  async function fetchJournals() {
    try {
      const isoStart = journalStart ? `${journalStart}T00:00:00` : '2026-01-01T00:00:00';
      const isoEnd = journalEnd ? `${journalEnd}T23:59:59` : '2026-12-31T23:59:59';
      const jrnls = await apiFetch<GlJournal[]>(`/api/accounting/journals/by-date?start=${isoStart}&end=${isoEnd}`);
      setJournals(jrnls);
    } catch (e: any) {
      toast.error('Failed to load journals: ' + e.message);
    }
  }

  async function fetchUnposted() {
    setLoadingUnposted(true);
    try {
      const [txsRes, poRes] = await Promise.all([
        apiFetch<any>('/api/transactions/unposted'),
        apiFetch<any>('/api/purchase-orders/unposted')
      ]);
      setUnpostedTxs(txsRes.data || []);
      setUnpostedPurchases(poRes.data || []);
    } catch (e: any) {
      toast.error('Failed to load unposted transactions: ' + e.message);
    } finally {
      setLoadingUnposted(false);
    }
  }

  async function postAllUnposted() {
    try {
      const p1 = apiFetch('/api/transactions/push-unposted', { method: 'POST' });
      const p2 = apiFetch('/api/purchase-orders/push-unposted', { method: 'POST' });
      await Promise.all([p1, p2]);
      toast.success('Successfully posted unposted transactions');
      fetchUnposted();
      fetchJournals();
    } catch (e: any) {
      toast.error('Error posting transactions: ' + e.message);
    }
  }

  async function fetchAll() {
    setLoading(true);
    try {
      const [accts, maps] = await Promise.all([
        apiFetch<GlAccount[]>('/api/accounting/accounts'),
        apiFetch<AccountMapping[]>('/api/accounting/accounts/mappings'),
      ]);
      setAccounts(accts);
      setMappings(maps);
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  }

  // ── Account CRUD ──
  function openNewAccount() {
    setEditingAccount(null);
    setAccountForm({ code: '', name: '', type: 'ASSET', description: '', active: true, isDefault: false, paymentMethod: '' });
    setAccountDialogOpen(true);
  }
  function openEditAccount(a: GlAccount) {
    setEditingAccount(a);
    setAccountForm({ code: a.code, name: a.name, type: a.type, description: a.description || '', active: a.active, isDefault: a.isDefault, paymentMethod: a.paymentMethod || '' });
    setAccountDialogOpen(true);
  }
  async function saveAccount() {
    try {
      const body: any = { ...accountForm, paymentMethod: accountForm.paymentMethod || null };
      if (editingAccount) {
        await apiFetch(`/api/accounting/accounts/${editingAccount.id}`, { method: 'PUT', body: JSON.stringify(body) });
        toast.success('Account updated');
      } else {
        await apiFetch('/api/accounting/accounts', { method: 'POST', body: JSON.stringify(body) });
        toast.success('Account created');
      }
      setAccountDialogOpen(false);
      fetchAll();
    } catch (e: any) { toast.error(e.message); }
  }
  async function deleteAccount(id: number) {
    if (!confirm('Delete this account?')) return;
    try {
      await apiFetch(`/api/accounting/accounts/${id}`, { method: 'DELETE' });
      toast.success('Account deleted');
      fetchAll();
    } catch (e: any) { toast.error(e.message); }
  }

  // ── Mapping CRUD ──
  function openNewMapping() {
    setEditingMapping(null);
    setMappingForm({ transactionType: '', debitAccountId: '', creditAccountId: '', description: '' });
    setMappingDialogOpen(true);
  }
  function openEditMapping(m: AccountMapping) {
    setEditingMapping(m);
    setMappingForm({
      transactionType: m.transactionType,
      debitAccountId: m.debitAccount?.id?.toString() || '',
      creditAccountId: m.creditAccount?.id?.toString() || '',
      description: m.description || ''
    });
    setMappingDialogOpen(true);
  }
  async function saveMapping() {
    try {
      const body: any = {
        transactionType: mappingForm.transactionType,
        debitAccount: mappingForm.debitAccountId ? { id: parseInt(mappingForm.debitAccountId) } : null,
        creditAccount: mappingForm.creditAccountId ? { id: parseInt(mappingForm.creditAccountId) } : null,
        description: mappingForm.description
      };
      if (editingMapping) {
        await apiFetch(`/api/accounting/accounts/mappings/${editingMapping.id}`, { method: 'PUT', body: JSON.stringify(body) });
        toast.success('Mapping updated');
      } else {
        await apiFetch('/api/accounting/accounts/mappings', { method: 'POST', body: JSON.stringify(body) });
        toast.success('Mapping created');
      }
      setMappingDialogOpen(false);
      fetchAll();
    } catch (e: any) { toast.error(e.message); }
  }
  async function deleteMapping(id: number) {
    if (!confirm('Delete this mapping?')) return;
    try {
      await apiFetch(`/api/accounting/accounts/mappings/${id}`, { method: 'DELETE' });
      toast.success('Mapping deleted');
      fetchAll();
    } catch (e: any) { toast.error(e.message); }
  }

  // ── Manual Journal ──
  function openNewJournal() {
    setJournalForm({ reference: '', description: '', entries: [{ debitAccountId: '', creditAccountId: '', amount: '', description: '' }] });
    setJournalDialogOpen(true);
  }
  function addJournalLine() {
    setJournalForm(f => ({ ...f, entries: [...f.entries, { debitAccountId: '', creditAccountId: '', amount: '', description: '' }] }));
  }
  function removeJournalLine(idx: number) {
    setJournalForm(f => ({ ...f, entries: f.entries.filter((_, i) => i !== idx) }));
  }
  function updateJournalLine(idx: number, field: string, value: string) {
    setJournalForm(f => ({
      ...f,
      entries: f.entries.map((e, i) => i === idx ? { ...e, [field]: value } : e)
    }));
  }
  async function saveJournal() {
    try {
      const entries = journalForm.entries.map(e => ({
        debitAccount: { id: parseInt(e.debitAccountId) },
        creditAccount: { id: parseInt(e.creditAccountId) },
        amount: parseFloat(e.amount) || 0,
        description: e.description
      }));
      for (const e of entries) {
        if (isNaN(e.debitAccount.id) || isNaN(e.creditAccount.id) || e.amount <= 0) {
          toast.error("All lines must have valid Debit/Credit accounts and an amount greater than zero.");
          return;
        }
        if (e.debitAccount.id === e.creditAccount.id) {
          toast.error("Debit account and Credit account cannot be the same.");
          return;
        }
      }
      const body = {
        reference: journalForm.reference,
        description: journalForm.description,
        entries
      };
      await apiFetch('/api/accounting/journals/manual', { method: 'POST', body: JSON.stringify(body) });
      toast.success('Manual journal posted');
      setJournalDialogOpen(false);
      fetchAll();
    } catch (e: any) { toast.error(e.message); }
  }

  // ── Reports ──
  async function fetchTrialBalance() {
    try {
      const data = await apiFetch<TrialBalanceRow[]>(
        `/api/accounting/reports/trial-balance?start=${reportStart}T00:00:00&end=${reportEnd}T23:59:59`
      );
      setTrialBalance(data);
    } catch (e: any) { toast.error(e.message); }
  }
  async function fetchProfitLoss() {
    try {
      const data = await apiFetch(
        `/api/accounting/reports/profit-and-loss?start=${reportStart}T00:00:00&end=${reportEnd}T23:59:59`
      );
      setProfitLoss(data);
    } catch (e: any) { toast.error(e.message); }
  }
  async function fetchBalanceSheet() {
    try {
      const data = await apiFetch(
        `/api/accounting/reports/balance-sheet?asOfDate=${reportEnd}T23:59:59`
      );
      setBalanceSheet(data);
    } catch (e: any) { toast.error(e.message); }
  }

  function fetchCurrentReport() {
    if (reportTab === 'trial-balance') fetchTrialBalance();
    else if (reportTab === 'profit-loss') fetchProfitLoss();
    else if (reportTab === 'balance-sheet') fetchBalanceSheet();
  }

  // ── Filtered lists ──
  const filteredAccounts = useMemo(() => {
    if (!accountSearch) return accounts;
    const q = accountSearch.toLowerCase();
    return accounts.filter(a => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
  }, [accounts, accountSearch]);

  const filteredJournals = useMemo(() => {
    if (!journalSearch) return journals;
    const q = journalSearch.toLowerCase();
    return journals.filter(j =>
      j.journalNumber.toLowerCase().includes(q) ||
      (j.description || '').toLowerCase().includes(q) ||
      (j.reference || '').toLowerCase().includes(q) ||
      (j.sourceModule || '').toLowerCase().includes(q)
    );
  }, [journals, journalSearch]);

  // ── Journal totals helper ──
  const journalTotals = (entries: GlJournalEntry[]) => {
    const total = entries.reduce((s, e) => s + (e.amount || 0), 0);
    return { dr: total, cr: total };
  };

  // ── Manual journal totals ──
  const manualJournalTotals = useMemo(() => {
    const total = journalForm.entries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const valid = journalForm.entries.every(e => e.debitAccountId && e.creditAccountId && parseFloat(e.amount) > 0);
    return { total, valid };
  }, [journalForm.entries]);

  // ── Affected accounts rows helper ──
  const affectedRows = useMemo(() => {
    if (!selectedJournalDetails || !selectedJournalDetails.entries) return [];
    const rows: { account: GlAccount; debit: number; credit: number; description: string }[] = [];
    selectedJournalDetails.entries.forEach(e => {
      if (e.debitAccount) {
        rows.push({
          account: e.debitAccount,
          debit: e.amount,
          credit: 0,
          description: e.description
        });
      }
      if (e.creditAccount) {
        rows.push({
          account: e.creditAccount,
          debit: 0,
          credit: e.amount,
          description: e.description
        });
      }
    });
    return rows;
  }, [selectedJournalDetails]);

  return (
    <AppLayout title="Accounting">
      <div className="space-y-4 py-2 max-w-7xl mx-auto px-4">
        <Tabs defaultValue="accounts" className="w-full" onValueChange={(v) => { if (v === 'unposted') fetchUnposted(); }}>
          <TabsList className="grid w-full grid-cols-5 mb-4">
            <TabsTrigger value="accounts" className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> Chart of Accounts</TabsTrigger>
            <TabsTrigger value="mappings" className="flex items-center gap-2"><Settings2 className="w-4 h-4" /> Posting Profiles</TabsTrigger>
            <TabsTrigger value="journals" className="flex items-center gap-2"><FileText className="w-4 h-4" /> GL Journals</TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Financial Reports</TabsTrigger>
            <TabsTrigger value="unposted" className="flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Unposted</TabsTrigger>
          </TabsList>

          {/* ══════════════════════════ CHART OF ACCOUNTS ══════════════════════════ */}
          <TabsContent value="accounts">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Chart of Accounts</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search accounts..." className="pl-8 w-60" value={accountSearch} onChange={e => setAccountSearch(e.target.value)} />
                  </div>
                  <Button onClick={openNewAccount} size="sm"><Plus className="w-4 h-4 mr-1" /> Add Account</Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono font-medium">{a.code}</TableCell>
                        <TableCell>{a.name}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            a.type === 'ASSET' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' :
                            a.type === 'LIABILITY' ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' :
                            a.type === 'EQUITY' ? 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300' :
                            a.type === 'INCOME' ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' :
                            'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
                          }`}>{a.type}</span>
                        </TableCell>
                        <TableCell>{a.paymentMethod || '—'}</TableCell>
                        <TableCell>{a.isDefault ? '✓' : ''}</TableCell>
                        <TableCell>{a.active ? <span className="text-green-600">Active</span> : <span className="text-muted-foreground">Inactive</span>}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditAccount(a)}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteAccount(a.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredAccounts.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No accounts found. Create your first account to get started.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════════════ POSTING PROFILES ══════════════════════════ */}
          <TabsContent value="mappings">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Posting Profiles (Account Mappings)</CardTitle>
                <Button onClick={openNewMapping} size="sm"><Plus className="w-4 h-4 mr-1" /> Add Mapping</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction Type</TableHead>
                      <TableHead>Debit Account</TableHead>
                      <TableHead>Credit Account</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.map(m => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono font-medium">{m.transactionType}</TableCell>
                        <TableCell>{m.debitAccount ? `${m.debitAccount.code} - ${m.debitAccount.name}` : '—'}</TableCell>
                        <TableCell>{m.creditAccount ? `${m.creditAccount.code} - ${m.creditAccount.name}` : '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{m.description || '—'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditMapping(m)}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteMapping(m.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {mappings.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No posting profiles configured. Add mappings to enable automatic GL posting.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════════════ GL JOURNALS ══════════════════════════ */}
          <TabsContent value="journals">
            <Card>
              <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
                <CardTitle className="text-lg">General Ledger Journals</CardTitle>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Label htmlFor="gl-start" className="text-xs font-medium">From:</Label>
                    <Input
                      id="gl-start"
                      type="date"
                      className="h-9 w-36 text-xs"
                      value={journalStart}
                      onChange={e => setJournalStart(e.target.value)}
                    />
                    <Label htmlFor="gl-end" className="text-xs font-medium ml-1">To:</Label>
                    <Input
                      id="gl-end"
                      type="date"
                      className="h-9 w-36 text-xs"
                      value={journalEnd}
                      onChange={e => setJournalEnd(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search journals..." className="pl-8 w-48 text-xs h-9" value={journalSearch} onChange={e => setJournalSearch(e.target.value)} />
                  </div>
                  <Button onClick={openNewJournal} size="sm" className="h-9 text-xs"><Plus className="w-4 h-4 mr-1" /> Manual Journal</Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Journal #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center w-24">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredJournals.map(j => {
                      const totals = journalTotals(j.entries);
                      return (
                        <TableRow key={j.id}>
                          <TableCell className="font-mono font-medium">{j.journalNumber}</TableCell>
                          <TableCell>{new Date(j.date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {j.sourceModule || 'MANUAL'}
                            </span>
                          </TableCell>
                          <TableCell>{j.reference || '—'}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{j.description || '—'}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(totals.dr)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(totals.cr)}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              j.status === 'POSTED' ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-red-50 text-red-700'
                            }`}>{j.status}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-xs hover:bg-accent font-medium"
                              onClick={() => setSelectedJournalDetails(j)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredJournals.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No journal entries yet. Transactions will appear here when posted.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════════════ UNPOSTED TRANSACTIONS ══════════════════════════ */}
          <TabsContent value="unposted">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Unposted Transactions</CardTitle>
                <div className="flex gap-2">
                  <Button onClick={fetchUnposted} variant="outline" size="sm" disabled={loadingUnposted}>
                    <RefreshCw className={`w-4 h-4 mr-1 ${loadingUnposted ? 'animate-spin' : ''}`} /> Refresh
                  </Button>
                  <Button onClick={postAllUnposted} size="sm" disabled={unpostedTxs.length === 0 && unpostedPurchases.length === 0}>
                    <Check className="w-4 h-4 mr-1" /> Post All to GL
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingUnposted ? (
                  <div className="py-8 text-center text-muted-foreground">Loading unposted transactions...</div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Inventory Transactions ({unpostedTxs.length})</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Journal #</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Total Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {unpostedTxs.map(t => (
                            <TableRow key={t.id}>
                              <TableCell className="font-mono">{t.journalNumber}</TableCell>
                              <TableCell>{new Date(t.timestamp).toLocaleString()}</TableCell>
                              <TableCell>{t.type}</TableCell>
                              <TableCell className="text-right">{fmt(t.totalAmount || 0)}</TableCell>
                            </TableRow>
                          ))}
                          {unpostedTxs.length === 0 && (
                            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No unposted inventory transactions.</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Purchase Orders ({unpostedPurchases.length})</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>PO #</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead className="text-right">Total Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {unpostedPurchases.map(p => (
                            <TableRow key={p.id}>
                              <TableCell className="font-mono">{p.journalNumber}</TableCell>
                              <TableCell>{new Date(p.timestamp || p.dateReceived).toLocaleString()}</TableCell>
                              <TableCell>{p.supplier?.name || '—'}</TableCell>
                              <TableCell className="text-right">{fmt(p.totalAmount || 0)}</TableCell>
                            </TableRow>
                          ))}
                          {unpostedPurchases.length === 0 && (
                            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No unposted purchase orders.</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════════════ FINANCIAL REPORTS ══════════════════════════ */}
          <TabsContent value="reports">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Financial Reports</CardTitle>
                <div className="flex flex-wrap items-end gap-4 mt-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">From</Label>
                    <Input type="date" value={reportStart} onChange={e => setReportStart(e.target.value)} className="w-40" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">To</Label>
                    <Input type="date" value={reportEnd} onChange={e => setReportEnd(e.target.value)} className="w-40" />
                  </div>
                  <Button onClick={fetchCurrentReport} size="sm"><RefreshCw className="w-4 h-4 mr-1" /> Generate</Button>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={reportTab} onValueChange={setReportTab}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
                    <TabsTrigger value="profit-loss">Profit & Loss</TabsTrigger>
                    <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
                  </TabsList>

                   {/* ── Trial Balance ── */}
                  <TabsContent value="trial-balance">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Account Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead className="text-center w-24">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trialBalance.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono">{r.accountCode}</TableCell>
                            <TableCell>{r.accountName}</TableCell>
                            <TableCell>{r.accountType}</TableCell>
                            <TableCell className="text-right font-mono">{fmt(r.debit)}</TableCell>
                            <TableCell className="text-right font-mono">{fmt(r.credit)}</TableCell>
                            <TableCell className={`text-right font-mono font-medium ${r.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(r.balance)}</TableCell>
                            <TableCell className="text-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700 font-normal"
                                onClick={() => fetchLedgerEntries(r.accountId, r.accountCode, r.accountName)}
                              >
                                <Search className="w-3.5 h-3.5 mr-1" /> View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {trialBalance.length > 0 && (
                          <TableRow className="font-bold border-t-2">
                            <TableCell colSpan={3}>TOTALS</TableCell>
                            <TableCell className="text-right font-mono">{fmt(trialBalance.reduce((s, r) => s + r.debit, 0))}</TableCell>
                            <TableCell className="text-right font-mono">{fmt(trialBalance.reduce((s, r) => s + r.credit, 0))}</TableCell>
                            <TableCell className="text-right font-mono">{fmt(trialBalance.reduce((s, r) => s + r.balance, 0))}</TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        )}
                        {trialBalance.length === 0 && (
                          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Click "Generate" to load the Trial Balance.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TabsContent>

                  {/* ── Profit & Loss ── */}
                  <TabsContent value="profit-loss">
                    {profitLoss ? (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-sm font-semibold text-green-600 flex items-center gap-1 mb-2"><TrendingUp className="w-4 h-4" /> Income</h3>
                          <Table>
                            <TableBody>
                              {(profitLoss.income || []).map((r: any, i: number) => (
                                <TableRow key={i}>
                                  <TableCell className="font-mono">{r.accountCode}</TableCell>
                                  <TableCell>{r.accountName}</TableCell>
                                  <TableCell className="text-right font-mono">{fmt(r.amount)}</TableCell>
                                </TableRow>
                              ))}
                              <TableRow className="font-bold border-t">
                                <TableCell colSpan={2}>Total Income</TableCell>
                                <TableCell className="text-right font-mono text-green-600">{fmt(profitLoss.totalIncome)}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-red-600 flex items-center gap-1 mb-2"><TrendingDown className="w-4 h-4" /> Expenses</h3>
                          <Table>
                            <TableBody>
                              {(profitLoss.expenses || []).map((r: any, i: number) => (
                                <TableRow key={i}>
                                  <TableCell className="font-mono">{r.accountCode}</TableCell>
                                  <TableCell>{r.accountName}</TableCell>
                                  <TableCell className="text-right font-mono">{fmt(r.amount)}</TableCell>
                                </TableRow>
                              ))}
                              <TableRow className="font-bold border-t">
                                <TableCell colSpan={2}>Total Expenses</TableCell>
                                <TableCell className="text-right font-mono text-red-600">{fmt(profitLoss.totalExpenses)}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                        <div className="p-4 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border">
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-bold flex items-center gap-2"><DollarSign className="w-5 h-5" /> Net Profit / (Loss)</span>
                            <span className={`text-2xl font-bold font-mono ${profitLoss.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {fmt(profitLoss.netProfit)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">Click "Generate" to load the Profit & Loss statement.</p>
                    )}
                  </TabsContent>

                  {/* ── Balance Sheet ── */}
                  <TabsContent value="balance-sheet">
                    {balanceSheet ? (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-sm font-semibold text-blue-600 mb-2">Assets</h3>
                          <Table>
                            <TableBody>
                              {(balanceSheet.assets || []).map((r: any, i: number) => (
                                <TableRow key={i}><TableCell className="font-mono">{r.accountCode}</TableCell><TableCell>{r.accountName}</TableCell><TableCell className="text-right font-mono">{fmt(r.amount)}</TableCell></TableRow>
                              ))}
                              <TableRow className="font-bold border-t"><TableCell colSpan={2}>Total Assets</TableCell><TableCell className="text-right font-mono text-blue-600">{fmt(balanceSheet.totalAssets)}</TableCell></TableRow>
                            </TableBody>
                          </Table>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-red-600 mb-2">Liabilities</h3>
                          <Table>
                            <TableBody>
                              {(balanceSheet.liabilities || []).map((r: any, i: number) => (
                                <TableRow key={i}><TableCell className="font-mono">{r.accountCode}</TableCell><TableCell>{r.accountName}</TableCell><TableCell className="text-right font-mono">{fmt(r.amount)}</TableCell></TableRow>
                              ))}
                              <TableRow className="font-bold border-t"><TableCell colSpan={2}>Total Liabilities</TableCell><TableCell className="text-right font-mono text-red-600">{fmt(balanceSheet.totalLiabilities)}</TableCell></TableRow>
                            </TableBody>
                          </Table>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-purple-600 mb-2">Equity</h3>
                          <Table>
                            <TableBody>
                              {(balanceSheet.equity || []).map((r: any, i: number) => (
                                <TableRow key={i}><TableCell className="font-mono">{r.accountCode}</TableCell><TableCell>{r.accountName}</TableCell><TableCell className="text-right font-mono">{fmt(r.amount)}</TableCell></TableRow>
                              ))}
                              <TableRow className="font-bold border-t"><TableCell colSpan={2}>Total Equity</TableCell><TableCell className="text-right font-mono text-purple-600">{fmt(balanceSheet.totalEquity)}</TableCell></TableRow>
                            </TableBody>
                          </Table>
                        </div>
                        <div className="p-4 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border">
                          <div className="flex items-center justify-between">
                            <span className="font-bold">Total Liabilities + Equity</span>
                            <span className="text-xl font-bold font-mono">{fmt(balanceSheet.totalLiabilitiesAndEquity)}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">Click "Generate" to load the Balance Sheet.</p>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ══════════════════════════ DIALOGS ══════════════════════════ */}

        {/* Account Dialog */}
        <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editingAccount ? 'Edit Account' : 'New Account'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Code</Label><Input value={accountForm.code} onChange={e => setAccountForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. 1100" /></div>
                <div>
                  <Label>Type</Label>
                  <Select value={accountForm.type} onValueChange={v => setAccountForm(f => ({ ...f, type: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Name</Label><Input value={accountForm.name} onChange={e => setAccountForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Cash on Hand" /></div>
              <div><Label>Description</Label><Textarea value={accountForm.description} onChange={e => setAccountForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Payment Method</Label>
                  <Select value={accountForm.paymentMethod} onValueChange={v => setAccountForm(f => ({ ...f, paymentMethod: v }))}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-4 pb-1">
                  <div className="flex items-center gap-2">
                    <Switch checked={accountForm.isDefault} onCheckedChange={c => setAccountForm(f => ({ ...f, isDefault: c }))} />
                    <Label className="text-sm">Default</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={accountForm.active} onCheckedChange={c => setAccountForm(f => ({ ...f, active: c }))} />
                    <Label className="text-sm">Active</Label>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAccountDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveAccount}>{editingAccount ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mapping Dialog */}
        <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editingMapping ? 'Edit Posting Profile' : 'New Posting Profile'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Transaction Type</Label>
                <Select value={mappingForm.transactionType} onValueChange={v => setMappingForm(f => ({ ...f, transactionType: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {TRANSACTION_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Debit Account</Label>
                <Select value={mappingForm.debitAccountId} onValueChange={v => setMappingForm(f => ({ ...f, debitAccountId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select debit account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.filter(a => a.active).map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.code} - {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Credit Account</Label>
                <Select value={mappingForm.creditAccountId} onValueChange={v => setMappingForm(f => ({ ...f, creditAccountId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select credit account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.filter(a => a.active).map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.code} - {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Description</Label><Textarea value={mappingForm.description} onChange={e => setMappingForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMappingDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveMapping}>{editingMapping ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manual Journal Dialog */}
        <Dialog open={journalDialogOpen} onOpenChange={setJournalDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Manual Journal Entry</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Reference</Label><Input value={journalForm.reference} onChange={e => setJournalForm(f => ({ ...f, reference: e.target.value }))} placeholder="e.g. DEP-2024-01" /></div>
                <div><Label>Description</Label><Input value={journalForm.description} onChange={e => setJournalForm(f => ({ ...f, description: e.target.value }))} placeholder="Monthly depreciation" /></div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-semibold">Journal Lines</Label>
                  <Button variant="outline" size="sm" onClick={addJournalLine}><Plus className="w-3 h-3 mr-1" /> Add Line</Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%]">Debit Account</TableHead>
                      <TableHead className="w-[30%]">Credit Account</TableHead>
                      <TableHead className="w-32">Amount</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {journalForm.entries.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <SearchableAccountSelect
                            value={e.debitAccountId}
                            onChange={v => updateJournalLine(i, 'debitAccountId', v)}
                            accounts={accounts.filter(a => a.active)}
                            placeholder="Select Debit"
                          />
                        </TableCell>
                        <TableCell>
                          <SearchableAccountSelect
                            value={e.creditAccountId}
                            onChange={v => updateJournalLine(i, 'creditAccountId', v)}
                            accounts={accounts.filter(a => a.active)}
                            placeholder="Select Credit"
                          />
                        </TableCell>
                        <TableCell><Input type="number" value={e.amount} onChange={ev => updateJournalLine(i, 'amount', ev.target.value)} placeholder="0.00" className="text-right font-mono" /></TableCell>
                        <TableCell><Input value={e.description} onChange={ev => updateJournalLine(i, 'description', ev.target.value)} placeholder="Line description" /></TableCell>
                        <TableCell>
                          {journalForm.entries.length > 1 && (
                            <Button variant="ghost" size="icon" onClick={() => removeJournalLine(i)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell colSpan={2} className="text-right">Total Journal Value:</TableCell>
                      <TableCell className="text-right font-mono">{fmt(manualJournalTotals.total)}</TableCell>
                      <TableCell colSpan={2}></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setJournalDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveJournal} disabled={!manualJournalTotals.valid}>Post Journal</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Account Ledger Modal */}
        <Dialog open={isLedgerModalOpen} onOpenChange={setIsLedgerModalOpen}>
          <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-6">
            <DialogHeader className="pb-2 border-b">
              <DialogTitle className="flex justify-between items-center text-lg pr-4">
                <span>Account Ledger: {selectedLedgerAccount?.code} - {selectedLedgerAccount?.name}</span>
                <span className="text-xs font-normal text-muted-foreground font-mono">
                  Period: {reportStart} to {reportEnd}
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto min-h-[300px] py-4">
              {loadingLedger ? (
                <div className="flex items-center justify-center h-full py-12 text-muted-foreground">
                  <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Loading ledger entries...
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-48">Date/Time</TableHead>
                        <TableHead className="w-32">Journal #</TableHead>
                        <TableHead className="w-32">Reference</TableHead>
                        <TableHead className="w-48">Offset Account</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right w-28">Debit</TableHead>
                        <TableHead className="text-right w-28">Credit</TableHead>
                        <TableHead className="text-right w-32">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledgerEntries.map((e, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-[11px] whitespace-nowrap">
                            {new Date(e.date).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-mono text-xs font-medium text-amber-600">
                            {e.journalNumber}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {e.reference || '—'}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground whitespace-normal py-2">
                            {e.otherAccountCode ? `${e.otherAccountCode} - ${e.otherAccountName || ''}` : '—'}
                          </TableCell>
                          <TableCell className="text-xs whitespace-normal break-words py-2">
                            {e.description}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {e.debit > 0.001 ? fmt(e.debit) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {e.credit > 0.001 ? fmt(e.credit) : '—'}
                          </TableCell>
                          <TableCell className={`text-right font-mono text-xs font-semibold ${e.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {fmt(e.balance)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {ledgerEntries.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                            No posted transactions found in this period.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            <DialogFooter className="pt-2 border-t mt-auto">
              <Button onClick={() => setIsLedgerModalOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Journal Details (Affected Accounts) Modal */}
        <Dialog open={!!selectedJournalDetails} onOpenChange={(open) => !open && setSelectedJournalDetails(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
            <DialogHeader className="pb-2 border-b">
              <DialogTitle className="flex justify-between items-center text-lg pr-4">
                <span>Journal Details: {selectedJournalDetails?.journalNumber}</span>
                <span className="text-xs font-normal text-muted-foreground font-mono">
                  Date: {selectedJournalDetails && new Date(selectedJournalDetails.date).toLocaleString()}
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto py-4">
              <div className="mb-4 grid grid-cols-2 gap-4 text-xs bg-muted/30 p-3 rounded-md border">
                <div><span className="font-semibold text-muted-foreground">Reference:</span> {selectedJournalDetails?.reference || '—'}</div>
                <div><span className="font-semibold text-muted-foreground">Source Module:</span> {selectedJournalDetails?.sourceModule || 'MANUAL'}</div>
                <div className="col-span-2"><span className="font-semibold text-muted-foreground">Description:</span> {selectedJournalDetails?.description || '—'}</div>
                <div><span className="font-semibold text-muted-foreground">Created By:</span> {selectedJournalDetails?.createdBy || 'System'}</div>
                <div><span className="font-semibold text-muted-foreground">Status:</span> <span className="font-semibold text-green-600">{selectedJournalDetails?.status}</span></div>
              </div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Affected Accounts & Double-Entries</h4>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="w-32">Account Code</TableHead>
                      <TableHead className="w-48">Account Name</TableHead>
                      <TableHead className="text-right w-24">Debit</TableHead>
                      <TableHead className="text-right w-24">Credit</TableHead>
                      <TableHead>Line Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {affectedRows.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-xs">{row.account?.code}</TableCell>
                        <TableCell className="text-xs font-medium">{row.account?.name}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.debit > 0.001 ? fmt(row.debit) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.credit > 0.001 ? fmt(row.credit) : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-normal py-1">
                          {row.description || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {affectedRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No affected accounts found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            <DialogFooter className="pt-2 border-t mt-auto">
              <Button onClick={() => setSelectedJournalDetails(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
