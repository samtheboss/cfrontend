import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { ShippingLocation, ApiResponse } from '@/types/inventory';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MapPin, Plus, Trash2, Loader2, Edit2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

export default function ShippingSettings() {
    const [locations, setLocations] = useState<ShippingLocation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [newLocation, setNewLocation] = useState({ name: '', fee: 0 });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState({ name: '', fee: 0 });

    useEffect(() => {
        fetchLocations();
    }, []);

    const fetchLocations = async () => {
        try {
            const response = await apiFetch<ApiResponse<ShippingLocation[]>>('/api/shipping-locations');
            setLocations(response.data);
        } catch (error) {
            toast.error('Failed to fetch shipping locations');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!newLocation.name) return;
        setIsSaving(true);
        try {
            const response = await apiFetch<ApiResponse<ShippingLocation>>('/api/shipping-locations', {
                method: 'POST',
                body: JSON.stringify({ ...newLocation, isActive: true }),
            });
            setLocations([...locations, response.data]);
            setNewLocation({ name: '', fee: 0 });
            toast.success('Shipping location added');
        } catch (error) {
            toast.error('Failed to add location');
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggle = async (location: ShippingLocation) => {
        try {
            const response = await apiFetch<ApiResponse<ShippingLocation>>(`/api/shipping-locations/${location.id}`, {
                method: 'PUT',
                body: JSON.stringify({ ...location, isActive: !location.isActive }),
            });
            setLocations(locations.map(l => l.id === response.data.id ? response.data : l));
        } catch (error) {
            toast.error('Failed to update location status');
        }
    };

    const handleStartEdit = (location: ShippingLocation) => {
        setEditingId(location.id);
        setEditForm({ name: location.name, fee: location.fee });
    };

    const handleSaveEdit = async (id: number) => {
        setIsSaving(true);
        try {
            const original = locations.find(l => l.id === id);
            if (!original) return;

            const response = await apiFetch<ApiResponse<ShippingLocation>>(`/api/shipping-locations/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ ...original, ...editForm }),
            });
            setLocations(locations.map(l => l.id === response.data.id ? response.data : l));
            setEditingId(null);
            toast.success('Location updated');
        } catch (error) {
            toast.error('Failed to update location');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this location?')) return;
        try {
            await apiFetch(`/api/shipping-locations/${id}`, { method: 'DELETE' });
            setLocations(locations.filter(l => l.id !== id));
            toast.success('Location deleted');
        } catch (error) {
            toast.error('Failed to delete location');
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle>Shipping Fees</CardTitle>
                        <CardDescription>Manage delivery locations and fees for eCommerce</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex gap-4 items-end bg-muted/50 p-4 rounded-lg">
                    <div className="flex-1 space-y-2">
                        <label className="text-sm font-medium">Location Name</label>
                        <Input
                            placeholder="e.g. Nairobi CBD"
                            value={newLocation.name}
                            onChange={e => setNewLocation({ ...newLocation, name: e.target.value })}
                        />
                    </div>
                    <div className="w-32 space-y-2">
                        <label className="text-sm font-medium">Fee</label>
                        <Input
                            type="number"
                            placeholder="0"
                            value={newLocation.fee}
                            onChange={e => setNewLocation({ ...newLocation, fee: parseFloat(e.target.value) || 0 })}
                        />
                    </div>
                    <Button onClick={handleAdd} disabled={isSaving || !newLocation.name}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                    </Button>
                </div>

                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Location</TableHead>
                                <TableHead>Fee</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {locations.map((loc) => (
                                <TableRow key={loc.id}>
                                    <TableCell className="font-medium">
                                        {editingId === loc.id ? (
                                            <Input
                                                value={editForm.name}
                                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                className="h-8 max-w-[200px]"
                                            />
                                        ) : (
                                            loc.name
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {editingId === loc.id ? (
                                            <Input
                                                type="number"
                                                value={editForm.fee}
                                                onChange={e => setEditForm({ ...editForm, fee: parseFloat(e.target.value) || 0 })}
                                                className="h-8 w-24"
                                            />
                                        ) : (
                                            `KES ${loc.fee.toLocaleString()}`
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Switch
                                            checked={loc.isActive}
                                            onCheckedChange={() => handleToggle(loc)}
                                            disabled={editingId === loc.id}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            {editingId === loc.id ? (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-green-600 hover:text-green-700"
                                                        onClick={() => handleSaveEdit(loc.id)}
                                                        disabled={isSaving}
                                                    >
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-gray-500 hover:text-gray-600"
                                                        onClick={() => setEditingId(null)}
                                                        disabled={isSaving}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-primary hover:text-primary/90"
                                                        onClick={() => handleStartEdit(loc)}
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive/90"
                                                        onClick={() => handleDelete(loc.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {locations.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                        No shipping locations defined yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
