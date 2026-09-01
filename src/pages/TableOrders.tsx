import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { Sale } from '@/types/inventory';
import { apiFetch, getBaseUrl } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { PaymentDialog, PaymentDetails } from '@/components/payments/PaymentDialog';
import { PdfPreviewDialog } from '@/components/receipts/PdfPreviewDialog';
import { usePdfPreview } from '@/hooks/usePdfPreview';
import {
  Utensils, Search, RefreshCw, Settings2, Wallet, Printer, ArrowRightLeft, Split,
  ChevronDown, ChevronUp, Combine, ShoppingCart, LayoutGrid, List, ChevronLeft,
} from 'lucide-react';

type StatusFilter = 'all' | 'available' | 'occupied';
type ViewMode = 'tables' | 'orders';

const balanceOf = (s: Sale) => Math.max(0, Number(s.totalAmount || 0) - Number(s.amountPaid || 0));
const qtyOf = (adjustment?: number) => Math.abs(Number(adjustment || 0));

/** Red gets deeper the larger the unpaid share of the bill; settled shows green. */
const balanceShade = (balance: number, gross: number) => {
  if (balance <= 0) return 'text-emerald-600 dark:text-emerald-500';
  const ratio = gross > 0 ? balance / gross : 1;
  if (ratio >= 0.999) return 'text-red-700 dark:text-red-500';
  if (ratio >= 0.5) return 'text-red-600 dark:text-red-400';
  return 'text-red-400 dark:text-red-300';
};

export default function TableOrders() {
  const navigate = useNavigate();
  const { fmt, computeTax } = useCurrency();
  const pdf = usePdfPreview();
  const { user, getUserRights } = useAuth();
  const rights = user ? getUserRights(user) : null;
  const can = {
    view: !rights || rights.viewTableOrders !== 'no',
    edit: !rights || rights.editTableOrder !== 'no',
    pay: !rights || rights.receiveTableOrderPayment !== 'no',
    transfer: !rights || rights.transferTableOrder !== 'no',
    mergeSplit: !rights || rights.mergeSplitTableOrders !== 'no',
  };
  const {
    tables = [], salesHistory = [], customers = [], settings,
    transferOrderTable, mergeTables, mergeOrders, splitOrder, requestPosLoad, refreshData,
  } = useInventory();

  const [viewMode, setViewMode] = useState<ViewMode>('tables');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [openTableId, setOpenTableId] = useState<number | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const [payingSale, setPayingSale] = useState<Sale | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  const [transferSale, setTransferSale] = useState<Sale | null>(null);
  const [transferTarget, setTransferTarget] = useState<string>('');

  const [splitSale, setSplitSale] = useState<Sale | null>(null);
  const [splitQty, setSplitQty] = useState<Record<string, string>>({});

  const [mergeSel, setMergeSel] = useState<string[]>([]);
  const [mergeTarget, setMergeTarget] = useState<string>('');

  const [tableMergeOpen, setTableMergeOpen] = useState(false);
  const [tableMergeFrom, setTableMergeFrom] = useState<string>('');
  const [tableMergeTo, setTableMergeTo] = useState<string>('');

  const inRange = (ts: any) => {
    const d = new Date(ts).getTime();
    if (startDate && d < new Date(`${startDate}T00:00:00`).getTime()) return false;
    if (endDate && d > new Date(`${endDate}T23:59:59.999`).getTime()) return false;
    return true;
  };

  const openSales = useMemo(
    () => (salesHistory || [])
      .filter(s => s.status === 'PAYMENT_PENDING' && s.tableId != null)
      .filter(s => inRange(s.timestamp))
      .slice()
      .sort((a, b) => new Date(b.timestamp as any).getTime() - new Date(a.timestamp as any).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [salesHistory, startDate, endDate]
  );

  const customerName = (s: Sale) => {
    const c = customers.find(c => String(c.id) === String(s.customerId));
    return c?.name || 'Walk-in';
  };

  const rows = useMemo(() => {
    const byTable = new Map<number, Sale[]>();
    openSales.forEach(s => {
      const list = byTable.get(s.tableId as number) || [];
      list.push(s);
      byTable.set(s.tableId as number, list);
    });

    const activeTables = (tables || []).filter(t => t.active !== false);
    const known = new Set(activeTables.map(t => t.id));
    const result = activeTables.map(t => ({
      id: t.id, code: t.code, name: t.name, capacity: t.capacity, orders: byTable.get(t.id) || [],
    }));
    byTable.forEach((orders, id) => {
      if (!known.has(id)) {
        result.push({ id, code: orders[0]?.tableName || `#${id}`, name: undefined, capacity: undefined, orders });
      }
    });

    return result.map(r => {
      const outstanding = r.orders.reduce((a, s) => a + balanceOf(s), 0);
      const paid = r.orders.reduce((a, s) => a + Number(s.amountPaid || 0), 0);
      const last = r.orders.reduce<string | null>((a, s) => {
        const ts = String(s.timestamp);
        return !a || ts > a ? ts : a;
      }, null);
      const cashier = Array.from(new Set(r.orders.map(s => s.createdBy).filter(Boolean))).join(', ');
      return {
        ...r, outstanding, paid, last, cashier,
        status: (r.orders.length > 0 ? 'OCCUPIED' : 'AVAILABLE') as 'OCCUPIED' | 'AVAILABLE',
      };
    });
  }, [openSales, tables]);

  const filteredRows = rows
    .filter(r => {
      if (statusFilter === 'available') return r.status === 'AVAILABLE';
      if (statusFilter === 'occupied') return r.status === 'OCCUPIED';
      return true;
    })
    .filter(r => {
      const q = search.trim().toLowerCase();
      return !q || r.code.toLowerCase().includes(q) || (r.name || '').toLowerCase().includes(q);
    })
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return openSales;
    return openSales.filter(s =>
      s.journalNumber.toLowerCase().includes(q) ||
      (s.tableName || '').toLowerCase().includes(q) ||
      customerName(s).toLowerCase().includes(q)
    );
  }, [openSales, search, customers]);

  const totals = useMemo(() => ({
    outstanding: rows.reduce((a, r) => a + r.outstanding, 0),
    paid: rows.reduce((a, r) => a + r.paid, 0),
    occupied: rows.filter(r => r.status === 'OCCUPIED').length,
    orders: openSales.length,
  }), [rows, openSales]);

  const openRow = rows.find(r => r.id === openTableId) || null;

  // Merge selection must stay within one table
  const mergeSales = openSales.filter(s => mergeSel.includes(s.journalNumber));
  const mergeSpansTables = new Set(mergeSales.map(s => s.tableId)).size > 1;

  const toggleMerge = (jn: string, on: boolean) =>
    setMergeSel(prev => (on ? [...prev, jn] : prev.filter(j => j !== jn)));
  const resetMerge = () => { setMergeSel([]); setMergeTarget(''); };

  const handleReceivePayment = async (finalPayments: PaymentDetails[]) => {
    if (!payingSale) return;
    if (!can.pay) { toast.error('You are not allowed to receive table payments'); return; }
    if (balanceOf(payingSale) <= 0.01) {
      toast.error('This order has already been paid in full.');
      setPayingSale(null);
      await refreshData();
      return;
    }
    const payments = finalPayments.map(p => ({
      method: p.method.toUpperCase(), amount: p.amount, reference: p.reference,
    }));
    setIsPaying(true);
    try {
      await apiFetch(`/api/transactions/sale/${payingSale.journalNumber}/receive-payment`, {
        method: 'POST', body: JSON.stringify(payments),
      });
      toast.success('Payment received');
      setPayingSale(null);
      await refreshData();
    } catch (e: any) {
      throw e;
    } finally {
      setIsPaying(false);
    }
  };

  const doTransfer = async () => {
    if (!can.transfer) { toast.error('You are not allowed to transfer table orders'); return; }
    if (!transferSale || !transferTarget) return;
    await transferOrderTable(transferSale.journalNumber, Number(transferTarget));
    setTransferSale(null);
    setTransferTarget('');
  };

  const doSplit = async () => {
    if (!can.mergeSplit) { toast.error('You are not allowed to split bills'); return; }
    if (!splitSale) return;
    const lines = (splitSale.items || [])
      .map(it => ({ variantId: Number(it.variantId), quantity: Number(splitQty[String(it.variantId)] || 0) }))
      .filter(l => l.variantId && l.quantity > 0);
    if (lines.length === 0) { toast.error('Enter a quantity to move to the new bill'); return; }
    await splitOrder(splitSale.journalNumber, lines);
    setSplitSale(null);
    setSplitQty({});
  };

  const doMergeOrders = async () => {
    if (!can.mergeSplit) { toast.error('You are not allowed to merge bills'); return; }
    const target = mergeTarget || mergeSel[0];
    const sources = mergeSel.filter(j => j !== target);
    if (!target || sources.length === 0) { toast.error('Pick at least two orders and a target'); return; }
    if (mergeSpansTables) { toast.error('Selected orders belong to different tables'); return; }
    await mergeOrders(target, sources);
    resetMerge();
  };

  const doMergeTables = async () => {
    if (!can.mergeSplit) { toast.error('You are not allowed to merge tables'); return; }
    if (!tableMergeFrom || !tableMergeTo || tableMergeFrom === tableMergeTo) {
      toast.error('Pick two different tables'); return;
    }
    await mergeTables(Number(tableMergeFrom), Number(tableMergeTo));
    setTableMergeOpen(false);
    setTableMergeFrom('');
    setTableMergeTo('');
  };

  const printReceipt = (s: Sale) =>
    pdf.showPdf(`${getBaseUrl()}/api/transactions/sale/${s.id}/receipt`, { title: `Receipt · ${s.journalNumber}` });
  const openInPos = (s: Sale) => {
    if (!can.edit) { toast.error('You are not allowed to edit table orders'); return; }
    requestPosLoad(Number(s.id));
    navigate('/pos');
  };

  const renderOrderCard = (s: Sale, showTable: boolean) => {
    const bal = balanceOf(s);
    const isExpanded = expandedOrder === s.journalNumber;
    return (
      <div key={s.journalNumber} className="rounded-lg border bg-card p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            {can.mergeSplit && (
              <Checkbox
                className="mt-0.5"
                checked={mergeSel.includes(s.journalNumber)}
                onCheckedChange={c => toggleMerge(s.journalNumber, !!c)}
              />
            )}
            <div className="min-w-0">
              <div className="font-mono text-xs truncate">{s.journalNumber}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                {showTable && (
                  <Badge variant="outline" className="text-[10px] h-4">{s.tableName || `#${s.tableId}`}</Badge>
                )}
                <span>{new Date(String(s.timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span>· {customerName(s)}</span>
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-base font-bold ${balanceShade(bal, Number(s.totalAmount || 0))}`}>{fmt(bal)}</div>
            <div className="text-[10px] text-muted-foreground">
              <span className={Number(s.amountPaid || 0) > 0 ? 'text-emerald-600 dark:text-emerald-500 font-medium' : ''}>
                {fmt(Number(s.amountPaid || 0))}
              </span>
              {' / '}{fmt(Number(s.totalAmount || 0))}
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="rounded bg-muted/40 p-2 space-y-1">
            {(s.items || []).map((it, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span>{it.productName} <span className="text-muted-foreground">× {qtyOf(it.adjustment)}</span></span>
                <span>{fmt(Number(it.price || 0) * qtyOf(it.adjustment))}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-1">
          {can.edit && (
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openInPos(s)}>
              <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Open / Add
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
            onClick={() => setExpandedOrder(isExpanded ? null : s.journalNumber)}>
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
            Items
          </Button>
          {can.pay && (
            <Button size="sm" className="h-7 px-2 text-xs bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => setPayingSale(s)}>
              <Wallet className="h-3.5 w-3.5 mr-1" /> Payment
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => printReceipt(s)} title="Print">
            <Printer className="h-3.5 w-3.5" />
          </Button>
          {can.transfer && (
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" title="Transfer table"
              onClick={() => { setTransferSale(s); setTransferTarget(''); }}>
              <ArrowRightLeft className="h-3.5 w-3.5" />
            </Button>
          )}
          {can.mergeSplit && (
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" title="Split bill"
              onClick={() => { setSplitSale(s); setSplitQty({}); }}>
              <Split className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  const mergeBar = can.mergeSplit && mergeSel.length >= 2 && (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2">
      <span className="text-sm font-medium">{mergeSel.length} orders selected</span>
      {mergeSpansTables ? (
        <span className="text-xs text-destructive">Orders are on different tables — can't merge</span>
      ) : (
        <>
          <Select value={mergeTarget} onValueChange={setMergeTarget}>
            <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Keep as…" /></SelectTrigger>
            <SelectContent>
              {mergeSel.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={doMergeOrders}>
            <Combine className="h-4 w-4 mr-1" /> Merge into one
          </Button>
        </>
      )}
      <Button size="sm" variant="ghost" onClick={resetMerge}>Clear</Button>
    </div>
  );

  if (!can.view) {
    return (
      <AppLayout title="Table Orders">
        <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="py-6 text-center text-sm text-amber-800 dark:text-amber-300">
            You don't have permission to view Table Orders. Ask an administrator for the
            "Table Orders: View Board" right.
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Table Orders">
      <div className="space-y-4">
        {!settings?.enableTableManagement && (
          <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="py-3 text-sm text-amber-800 dark:text-amber-300">
              Table Management is disabled — enable it in System Settings for the POS to use tables.
            </CardContent>
          </Card>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5">
            <Button
              size="sm"
              variant={viewMode === 'tables' ? 'default' : 'ghost'}
              className="h-7"
              onClick={() => { setViewMode('tables'); resetMerge(); }}
            >
              <LayoutGrid className="h-4 w-4 mr-1" /> By Table
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'orders' ? 'default' : 'ghost'}
              className="h-7"
              onClick={() => { setViewMode('orders'); setOpenTableId(null); resetMerge(); }}
            >
              <List className="h-4 w-4 mr-1" /> All Orders
            </Button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={viewMode === 'tables' ? 'Search table…' : 'Search order / table / customer…'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {viewMode === 'tables' && (
            <div className="flex gap-1">
              {(['all', 'available', 'occupied'] as StatusFilter[]).map(f => (
                <Button
                  key={f}
                  size="sm"
                  variant={statusFilter === f ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(f)}
                  className="capitalize"
                >
                  {f}
                </Button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1">
            <Input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={e => setStartDate(e.target.value)}
              className="h-8 w-[9.5rem] text-xs"
              title="From date"
            />
            <span className="text-muted-foreground text-xs">–</span>
            <Input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={e => setEndDate(e.target.value)}
              className="h-8 w-[9.5rem] text-xs"
              title="To date"
            />
            {(startDate || endDate) && (
              <Button size="sm" variant="ghost" className="h-8 px-2 text-xs"
                onClick={() => { setStartDate(''); setEndDate(''); }}>
                Clear
              </Button>
            )}
          </div>

          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => refreshData()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          {can.mergeSplit && (
            <Button size="sm" variant="outline" onClick={() => setTableMergeOpen(true)}>
              <Combine className="h-4 w-4 mr-1" /> Merge Tables
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => navigate('/tables')}>
            <Settings2 className="h-4 w-4 mr-1" /> Manage Tables
          </Button>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryTile label="Occupied tables" value={`${totals.occupied} / ${rows.length}`} />
          <SummaryTile label="Open orders" value={String(totals.orders)} />
          <SummaryTile label="Outstanding" value={fmt(totals.outstanding)} accent="red" />
          <SummaryTile label="Paid (open bills)" value={fmt(totals.paid)} accent="green" />
        </div>

        {mergeBar}

        {/* ---- By Table view ---- */}
        {viewMode === 'tables' && !openRow && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredRows.map(r => (
              <button
                key={r.id}
                onClick={() => { setOpenTableId(r.id); setExpandedOrder(null); }}
                className={`text-left rounded-xl border p-4 transition hover:border-primary hover:shadow-sm ${
                  r.status === 'OCCUPIED'
                    ? 'bg-amber-50 border-amber-300 dark:bg-amber-950/20 dark:border-amber-800'
                    : 'bg-card'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Utensils className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold leading-none">{r.code}</div>
                      {r.name && <div className="text-[11px] text-muted-foreground">{r.name}</div>}
                    </div>
                  </div>
                  <Badge variant={r.status === 'OCCUPIED' ? 'default' : 'secondary'} className="text-[10px]">
                    {r.status}
                  </Badge>
                </div>

                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <div className="text-[11px] text-muted-foreground">Outstanding</div>
                    <div className={`text-lg font-bold ${balanceShade(r.outstanding, r.outstanding + r.paid)}`}>{fmt(r.outstanding)}</div>
                  </div>
                  <div className="text-right text-[11px] text-muted-foreground">
                    <div>{r.orders.length} order{r.orders.length === 1 ? '' : 's'}</div>
                    {r.paid > 0 && <div className="text-emerald-600 dark:text-emerald-500 font-medium">{fmt(r.paid)} paid</div>}
                  </div>
                </div>

                <div className="mt-2 text-[10px] text-muted-foreground truncate">
                  {r.cashier ? `${r.cashier} · ` : ''}
                  {r.last ? new Date(r.last).toLocaleString() : 'No activity'}
                </div>
              </button>
            ))}
            {filteredRows.length === 0 && (
              <div className="col-span-full text-center text-muted-foreground py-10">No tables match.</div>
            )}
          </div>
        )}

        {/* ---- Single table detail ---- */}
        {viewMode === 'tables' && openRow && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => { setOpenTableId(null); resetMerge(); }}>
                <ChevronLeft className="h-4 w-4 mr-1" /> All tables
              </Button>
              <div className="text-sm text-muted-foreground">
                Table <span className="font-semibold text-foreground">{openRow.code}</span> ·
                {' '}{openRow.orders.length} open · Outstanding{' '}
                <span className={`font-semibold ${balanceShade(openRow.outstanding, openRow.outstanding + openRow.paid)}`}>
                  {fmt(openRow.outstanding)}
                </span>
              </div>
            </div>
            {openRow.orders.length === 0 ? (
              <div className="text-center text-muted-foreground py-10">This table has no open orders.</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {openRow.orders.map(s => renderOrderCard(s, false))}
              </div>
            )}
          </div>
        )}

        {/* ---- All Orders view ---- */}
        {viewMode === 'orders' && (
          filteredOrders.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">No open orders.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredOrders.map(s => renderOrderCard(s, true))}
            </div>
          )
        )}
      </div>

      {/* Receive payment */}
      <PaymentDialog
        module="POS"
        open={!!payingSale}
        onOpenChange={open => { if (!open && !isPaying) setPayingSale(null); }}
        totalAmount={payingSale ? balanceOf(payingSale) : 0}
        allowPartialPayment
        onSubmit={handleReceivePayment}
        isProcessing={isPaying}
        onCancel={() => setPayingSale(null)}
        title="Receive Payment"
        description={payingSale ? `Order ${payingSale.journalNumber} · balance ${fmt(balanceOf(payingSale))}` : ''}
        submitText="Receive Payment"
      />

      {/* Transfer table */}
      <Dialog open={!!transferSale} onOpenChange={open => !open && setTransferSale(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer order</DialogTitle>
            <DialogDescription>
              Move {transferSale?.journalNumber} from {transferSale?.tableName} to another table.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>Transfer to</Label>
            <Select value={transferTarget} onValueChange={setTransferTarget}>
              <SelectTrigger><SelectValue placeholder="Select a table" /></SelectTrigger>
              <SelectContent>
                {(tables || [])
                  .filter(t => t.active !== false && t.id !== transferSale?.tableId)
                  .map(t => <SelectItem key={t.id} value={String(t.id)}>{t.code}{t.name ? ` — ${t.name}` : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferSale(null)}>Cancel</Button>
            <Button onClick={doTransfer} disabled={!transferTarget}>Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Split bill */}
      <Dialog open={!!splitSale} onOpenChange={open => !open && setSplitSale(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Split bill</DialogTitle>
            <DialogDescription>
              Move items off {splitSale?.journalNumber} into a new bill on the same table.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 max-h-72 overflow-y-auto">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground px-1">
              <span>Item</span>
              <span className="w-20 text-center">Move qty</span>
              <span className="w-24 text-right">Amount</span>
            </div>
            {(splitSale?.items || []).map((it, i) => {
              const max = qtyOf(it.adjustment);
              const unit = Number(it.price || 0);
              const moveQty = Math.min(max, Math.max(0, Number(splitQty[String(it.variantId)] || 0)));
              return (
                <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1 py-1">
                  <div className="text-sm min-w-0">
                    <div className="truncate">{it.productName}</div>
                    <span className="text-[11px] text-muted-foreground">{fmt(unit)} · have {max}</span>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={max}
                    className="w-20 h-8"
                    value={splitQty[String(it.variantId)] || ''}
                    onChange={e => setSplitQty(p => ({ ...p, [String(it.variantId)]: e.target.value }))}
                    placeholder="0"
                  />
                  <span className="w-24 text-right text-sm tabular-nums">{fmt(unit * moveQty)}</span>
                </div>
              );
            })}
          </div>
          {splitSale && (() => {
            const taxRateOf = (it: any) => Number(it.taxRate ?? settings?.taxRate ?? 0);
            const moveQtyOf = (it: any) =>
              Math.min(qtyOf(it.adjustment), Math.max(0, Number(splitQty[String(it.variantId)] || 0)));

            const agg = (qtyFn: (it: any) => number) =>
              (splitSale.items || []).reduce(
                (a, it) => {
                  const t = computeTax(qtyFn(it), Number(it.price || 0), taxRateOf(it));
                  return { subtotal: a.subtotal + t.subtotal, tax: a.tax + t.tax, total: a.total + t.total };
                },
                { subtotal: 0, tax: 0, total: 0 }
              );

            const orig = agg(it => qtyOf(it.adjustment));
            const moving = agg(moveQtyOf);
            const remaining = {
              subtotal: Math.max(0, orig.subtotal - moving.subtotal),
              tax: Math.max(0, orig.tax - moving.tax),
              total: Math.max(0, orig.total - moving.total),
            };
            return (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 tabular-nums">
                  <span />
                  <span className="w-24 text-right text-[11px] text-muted-foreground">New bill</span>
                  <span className="w-24 text-right text-[11px] text-muted-foreground">Remaining</span>

                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="w-24 text-right">{fmt(moving.subtotal)}</span>
                  <span className="w-24 text-right">{fmt(remaining.subtotal)}</span>

                  <span className="text-muted-foreground">VAT</span>
                  <span className="w-24 text-right">{fmt(moving.tax)}</span>
                  <span className="w-24 text-right">{fmt(remaining.tax)}</span>

                  <span className="font-semibold pt-1 border-t mt-1">Total</span>
                  <span className="w-24 text-right font-semibold pt-1 border-t mt-1">{fmt(moving.total)}</span>
                  <span className="w-24 text-right font-semibold pt-1 border-t mt-1">{fmt(remaining.total)}</span>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSplitSale(null)}>Cancel</Button>
            <Button onClick={doSplit}>Split into new bill</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge tables */}
      <Dialog open={tableMergeOpen} onOpenChange={setTableMergeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge tables</DialogTitle>
            <DialogDescription>Move every open bill from one table onto another. Bills stay separate.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label>From</Label>
              <Select value={tableMergeFrom} onValueChange={setTableMergeFrom}>
                <SelectTrigger><SelectValue placeholder="Table" /></SelectTrigger>
                <SelectContent>
                  {rows.filter(r => r.status === 'OCCUPIED').map(r => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.code} ({r.orders.length})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Into</Label>
              <Select value={tableMergeTo} onValueChange={setTableMergeTo}>
                <SelectTrigger><SelectValue placeholder="Table" /></SelectTrigger>
                <SelectContent>
                  {(tables || []).filter(t => t.active !== false).map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTableMergeOpen(false)}>Cancel</Button>
            <Button onClick={doMergeTables}>Merge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt preview / print */}
      <PdfPreviewDialog
        open={pdf.open}
        onOpenChange={pdf.setOpen}
        url={pdf.url}
        title={pdf.title}
        iframeRef={pdf.iframeRef}
        onPrint={pdf.handlePrint}
        autoPrintOnLoad={pdf.autoPrintOnLoad}
      />
    </AppLayout>
  );
}

function SummaryTile({ label, value, accent }: { label: string; value: string; accent?: 'amber' | 'green' | 'red' }) {
  const color =
    accent === 'amber' ? 'text-amber-600'
      : accent === 'green' ? 'text-green-600'
      : accent === 'red' ? 'text-red-600 dark:text-red-400'
      : 'text-foreground';
  return (
    <Card>
      <CardContent className="py-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-lg font-semibold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
