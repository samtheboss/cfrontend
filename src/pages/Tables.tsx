import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { RestaurantTable } from '@/types/inventory';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Utensils, Edit, Plus, Trash2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

const emptyForm = { code: '', name: '', capacity: '', active: true, sortOrder: '' };

export default function Tables() {
  const { tables, addTable, updateTable, deleteTable, settings } = useInventory();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<RestaurantTable | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = (tables || []).filter(
    t =>
      t.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openAdd = () => {
    setForm(emptyForm);
    setIsAddOpen(true);
  };
  const openEdit = (t: RestaurantTable) => {
    setForm({
      code: t.code,
      name: t.name || '',
      capacity: t.capacity != null ? String(t.capacity) : '',
      active: t.active,
      sortOrder: t.sortOrder != null ? String(t.sortOrder) : '',
    });
    setEditing(t);
  };

  const payload = () => ({
    code: form.code.trim(),
    name: form.name.trim() || undefined,
    capacity: form.capacity ? Number(form.capacity) : undefined,
    active: form.active,
    sortOrder: form.sortOrder ? Number(form.sortOrder) : undefined,
  });

  const submitAdd = async () => {
    if (!form.code.trim()) return;
    setIsSubmitting(true);
    try {
      await addTable(payload());
      setIsAddOpen(false);
    } catch { /* toast shown in context */ } finally {
      setIsSubmitting(false);
    }
  };

  const submitEdit = async () => {
    if (!editing || !form.code.trim()) return;
    setIsSubmitting(true);
    try {
      await updateTable(editing.id, payload());
      setEditing(null);
    } catch { /* toast shown in context */ } finally {
      setIsSubmitting(false);
    }
  };

  const formFields = (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="code">Table Code *</Label>
          <Input
            id="code"
            value={form.code}
            onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
            placeholder="e.g. T01, VIP 01"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="capacity">Capacity</Label>
          <Input
            id="capacity"
            type="number"
            min={0}
            value={form.capacity}
            onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))}
            placeholder="e.g. 4"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Name / Description</Label>
        <Input
          id="name"
          value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          placeholder="e.g. Window seat"
        />
      </div>
      <div className="grid grid-cols-2 gap-4 items-end">
        <div className="space-y-2">
          <Label htmlFor="sortOrder">Sort Order</Label>
          <Input
            id="sortOrder"
            type="number"
            value={form.sortOrder}
            onChange={e => setForm(p => ({ ...p, sortOrder: e.target.value }))}
            placeholder="0"
          />
        </div>
        <div className="flex items-center justify-between rounded-md border px-3 h-10">
          <Label>Active</Label>
          <Switch
            checked={form.active}
            onCheckedChange={checked => setForm(p => ({ ...p, active: checked }))}
          />
        </div>
      </div>
    </div>
  );

  return (
    <AppLayout title="Tables">
      <div className="space-y-6">
        {!settings?.enableTableManagement && (
          <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="py-3 text-sm text-amber-800 dark:text-amber-300">
              Table Management is currently disabled. Turn on{' '}
              <span className="font-medium">Enable Table Management</span> in System Settings for
              tables to appear in the POS.
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tables..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Table
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tables</CardTitle>
            <CardDescription>Configure the physical tables used by the POS.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(t => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Utensils className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{t.code}</p>
                            {t.name && <span className="text-sm text-muted-foreground">{t.name}</span>}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{t.capacity != null ? `${t.capacity} seats` : '—'}</TableCell>
                    <TableCell>
                      {t.active ? (
                        <Badge variant="secondary" className="text-[10px]">Active</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">Inactive</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTable(t.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No tables yet. Add one to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Table</DialogTitle>
              <DialogDescription>Create a new table for the POS.</DialogDescription>
            </DialogHeader>
            {formFields}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={submitAdd} disabled={!form.code.trim() || isSubmitting}>
                {isSubmitting ? 'Adding...' : 'Add Table'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Table</DialogTitle>
              <DialogDescription>Update table details.</DialogDescription>
            </DialogHeader>
            {formFields}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={submitEdit} disabled={!form.code.trim() || isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
