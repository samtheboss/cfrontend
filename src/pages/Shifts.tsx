import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api';
import { Shift, ShiftSummary } from '@/types/shift';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ShiftStatusChip } from '@/components/shifts/ShiftStatusChip';
import { Loader2, RefreshCw } from 'lucide-react';

const formatLocalISO = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const toDateInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function Shifts() {
  const { settings, locations } = useInventory();
  const { user, getUserRights } = useAuth();
  const rights = user ? getUserRights(user) : null;
  const canView = !rights || rights.viewShiftHistory !== 'no';

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return toDateInput(d);
  });
  const [endDate, setEndDate] = useState(() => toDateInput(new Date()));
  const [locationId, setLocationId] = useState('all');
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const [sy, sm, sd] = startDate.split('-').map(Number);
      const [ey, em, ed] = endDate.split('-').map(Number);
      const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
      const end = new Date(ey, em - 1, ed, 23, 59, 59, 999);
      const params = new URLSearchParams({ startDate: formatLocalISO(start), endDate: formatLocalISO(end) });
      if (locationId !== 'all') params.append('locationId', locationId);
      const res = await apiFetch<{ data: Shift[] }>(`/api/shifts?${params.toString()}`);
      setShifts(res.data || []);
    } catch {
      setShifts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canView) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, locationId, canView]);

  const openSummary = async (shift: Shift) => {
    setSelectedShift(shift);
    setSummary(null);
    try {
      const res = await apiFetch<{ data: ShiftSummary }>(`/api/shifts/${shift.id}/summary`);
      setSummary(res.data);
    } catch {
      setSummary(null);
    }
  };

  const locationName = (id?: string | null) => {
    if (!id) return '—';
    return locations.find((l) => l.id === id)?.name || id;
  };

  if (!canView) {
    return (
      <AppLayout title="Shift Management">
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            You don't have permission to view shift history.
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Shift Management">
      <div className="space-y-4">
        {!settings?.enableShiftManagement && (
          <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="py-3 text-sm text-amber-800 dark:text-amber-300">
              Shift Management is disabled — enable it in System Settings to start tracking shifts.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <ShiftStatusChip />
            <div className="ml-auto flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input type="date" className="h-9" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input type="date" className="h-9" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Location</Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={load}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Shift History</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shift</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Opened</TableHead>
                    <TableHead>Closed</TableHead>
                    <TableHead>Opened By</TableHead>
                    <TableHead className="text-right">Float</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={11} className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
                  ) : shifts.length === 0 ? (
                    <TableRow><TableCell colSpan={11} className="py-8 text-center text-sm text-muted-foreground">No shifts in this range</TableCell></TableRow>
                  ) : shifts.map((s) => (
                    <TableRow key={s.id} className="cursor-pointer" onClick={() => openSummary(s)}>
                      <TableCell className="text-xs font-medium">{s.shiftNumber}</TableCell>
                      <TableCell className="text-xs">{s.mode}{s.scheduleName ? ` (${s.scheduleName})` : ''}</TableCell>
                      <TableCell className="text-xs">{s.scope === 'GLOBAL' ? 'All Locations' : locationName(s.locationId)}</TableCell>
                      <TableCell className="text-xs">{s.openedAt ? new Date(s.openedAt).toLocaleString() : '—'}</TableCell>
                      <TableCell className="text-xs">{s.closedAt ? new Date(s.closedAt).toLocaleString() : '—'}</TableCell>
                      <TableCell className="text-xs">{s.openedByName || '—'}</TableCell>
                      <TableCell className="text-right text-xs">{(s.openingCashFloat ?? 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-xs">{s.expectedClosingCash != null ? s.expectedClosingCash.toFixed(2) : '—'}</TableCell>
                      <TableCell className="text-right text-xs">{s.actualClosingCash != null ? s.actualClosingCash.toFixed(2) : '—'}</TableCell>
                      <TableCell className={`text-right text-xs ${s.cashVariance ? (s.cashVariance < 0 ? 'text-red-500' : 'text-emerald-600') : ''}`}>
                        {s.cashVariance != null ? s.cashVariance.toFixed(2) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.status === 'OPEN' ? 'default' : 'outline'} className="text-[10px]">{s.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedShift} onOpenChange={(v) => { if (!v) { setSelectedShift(null); setSummary(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Shift {selectedShift?.shiftNumber}</DialogTitle>
            <DialogDescription>
              {selectedShift?.mode} · {selectedShift?.status} · Opened by {selectedShift?.openedByName || '—'}
            </DialogDescription>
          </DialogHeader>
          {summary ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Sales Count</span><span>{summary.saleCount}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Tendered</span><span>{summary.totalTendered.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Refunds</span><span>{summary.totalRefunds.toFixed(2)}</span></div>
              <div className="space-y-1 border-t pt-2">
                <p className="text-xs font-semibold text-muted-foreground">By Payment Method</p>
                {Object.entries(summary.paymentsByMethod).length === 0 ? (
                  <p className="text-xs italic text-muted-foreground">No payments recorded</p>
                ) : Object.entries(summary.paymentsByMethod).map(([method, amount]) => (
                  <div key={method} className="flex justify-between text-xs">
                    <span>{method}</span><span>{Number(amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              {selectedShift?.status === 'CLOSED' && (
                <div className="space-y-1 border-t pt-2">
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Expected Cash</span><span>{selectedShift.expectedClosingCash?.toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Actual Cash</span><span>{selectedShift.actualClosingCash?.toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs font-medium"><span>Variance</span><span>{selectedShift.cashVariance?.toFixed(2)}</span></div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
