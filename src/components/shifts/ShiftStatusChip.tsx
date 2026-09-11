import { useEffect, useState } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Lock } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { CloseShiftRequest, OpenShiftRequest, ShiftSummary } from '@/types/shift';
import { Location } from '@/types/inventory';

/** Always-visible shift indicator + open/close actions, meant to live in the app shell
 * (Workspace tab bar) so it is visible no matter which module tab is active. */
export function ShiftStatusChip() {
  const { currentShift, openShift, closeShift, locations } = useInventory();
  const { user, getUserRights } = useAuth();
  const rights = user ? getUserRights(user) : null;
  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  if (!currentShift?.enabled) {
    return null;
  }

  const canOpen = !rights || rights.openShift !== 'no';
  const canClose = !rights || rights.closeShift !== 'no';
  const shift = currentShift.shift;
  const isManual = currentShift.mode === 'MANUAL';

  return (
    <>
      <div className="flex items-center gap-2 px-2">
        {shift ? (
          <Badge variant="outline" className="gap-1.5 border-emerald-600/40 bg-emerald-500/10 text-emerald-400 text-[11px]">
            <Clock className="h-3 w-3" />
            {shift.shiftNumber}{shift.scheduleName ? ` · ${shift.scheduleName}` : ''}
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1.5 border-amber-600/40 bg-amber-500/10 text-amber-400 text-[11px]">
            <Lock className="h-3 w-3" /> No shift open
          </Badge>
        )}
        {isManual && !shift && canOpen && (
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setOpenDialogOpen(true)}>
            Open Shift
          </Button>
        )}
        {isManual && shift && canClose && (
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setCloseDialogOpen(true)}>
            Close Shift
          </Button>
        )}
      </div>

      <OpenShiftDialog
        open={openDialogOpen}
        onOpenChange={setOpenDialogOpen}
        onSubmit={openShift}
        locations={locations}
        defaultLocationId={(user as any)?.locationId}
        scope={currentShift.scope}
      />
      {shift && (
        <CloseShiftDialog
          open={closeDialogOpen}
          onOpenChange={setCloseDialogOpen}
          shiftId={shift.id}
          onSubmit={(req) => closeShift(shift.id, req)}
        />
      )}
    </>
  );
}

function OpenShiftDialog({
  open, onOpenChange, onSubmit, locations, defaultLocationId, scope,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (req: OpenShiftRequest) => Promise<void>;
  locations: Location[];
  defaultLocationId?: string;
  scope: 'PER_LOCATION' | 'GLOBAL';
}) {
  const [locationId, setLocationId] = useState(defaultLocationId || '');
  const [openingCashFloat, setOpeningCashFloat] = useState('0');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setLocationId(defaultLocationId || '');
      setOpeningCashFloat('0');
      setNotes('');
    }
  }, [open, defaultLocationId]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit({
        locationId: scope === 'GLOBAL' ? undefined : locationId,
        openingCashFloat: parseFloat(openingCashFloat) || 0,
        notes: notes || undefined,
      });
      onOpenChange(false);
    } catch {
      // toast already shown by the context action
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Open Shift</DialogTitle>
          <DialogDescription>Start a new shift with an opening cash float.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {scope === 'PER_LOCATION' && (
            <div className="space-y-1">
              <Label className="text-xs">Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Opening Cash Float</Label>
            <Input type="number" min={0} value={openingCashFloat} onChange={(e) => setOpeningCashFloat(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || (scope === 'PER_LOCATION' && !locationId)}>
            Open Shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloseShiftDialog({
  open, onOpenChange, shiftId, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shiftId: number;
  onSubmit: (req: CloseShiftRequest) => Promise<void>;
}) {
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [actualClosingCash, setActualClosingCash] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && shiftId) {
      setNotes('');
      apiFetch<{ data: ShiftSummary }>(`/api/shifts/${shiftId}/summary`)
        .then((res) => {
          setSummary(res.data);
          const opening = res.data.shift.openingCashFloat || 0;
          const cash = res.data.paymentsByMethod?.CASH || 0;
          setActualClosingCash((opening + cash - (res.data.totalRefunds || 0)).toFixed(2));
        })
        .catch(() => {});
    }
  }, [open, shiftId]);

  const expected = summary
    ? (summary.shift.openingCashFloat || 0) + (summary.paymentsByMethod?.CASH || 0) - (summary.totalRefunds || 0)
    : null;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit({ actualClosingCash: parseFloat(actualClosingCash) || 0, notes: notes || undefined });
      onOpenChange(false);
    } catch {
      // toast already shown by the context action
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Close Shift</DialogTitle>
          <DialogDescription>Count the drawer and record the actual closing cash.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {expected != null && (
            <div className="space-y-1 rounded-md border bg-muted/20 p-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected Cash</span>
                <span className="font-medium">{expected.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Tendered (all methods)</span>
                <span className="font-medium">{(summary?.totalTendered || 0).toFixed(2)}</span>
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Actual Closing Cash</Label>
            <Input type="number" value={actualClosingCash} onChange={(e) => setActualClosingCash(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>Close Shift</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
