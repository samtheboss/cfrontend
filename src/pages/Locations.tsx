import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { Location } from '@/types/inventory';
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
    TableRow
} from '@/components/ui/table';
import {
    MapPin,
    Edit,
    Plus,
    Trash2,
    Search,
    Home,
    Check
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

export default function Locations() {
    const { locations, addLocation, updateLocation, deleteLocation } = useInventory();

    const [searchQuery, setSearchQuery] = useState('');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState<Location | null>(null);
    const [newLocation, setNewLocation] = useState({
        name: '',
        address: '',
        isMain: false,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const filteredLocations = locations.filter(l =>
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.address && l.address.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleAddLocation = async () => {
        if (!newLocation.name) return;

        setIsSubmitting(true);
        try {
            await addLocation({
                name: newLocation.name,
                address: newLocation.address,
                isMain: newLocation.isMain,
            });

            setNewLocation({ name: '', address: '', isMain: false });
            setIsAddDialogOpen(false);
        } catch (error) {
            console.error('Error adding location:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateLocation = async () => {
        if (!editingLocation) return;
        setIsSubmitting(true);
        try {
            await updateLocation(editingLocation);
            setEditingLocation(null);
        } catch (error) {
            console.error('Error updating location:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AppLayout title="Location Management">
            <div className="space-y-6">
                {/* Header Actions */}
                <div className="flex items-center justify-between">
                    <div className="relative w-80">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search locations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Button onClick={() => setIsAddDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Location
                    </Button>
                </div>

                {/* Locations Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Locations</CardTitle>
                        <CardDescription>Manage your business branches and warehouses.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Location</TableHead>
                                    <TableHead>Address</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredLocations.map((location) => (
                                    <TableRow key={location.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                                    <MapPin className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="font-medium">{location.name}</p>
                                                    {location.isMain && (
                                                        <Badge variant="secondary" className="text-[10px] h-4">Main</Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <p className="text-sm text-muted-foreground">{location.address || 'No address'}</p>
                                        </TableCell>
                                        <TableCell>
                                            {location.isMain ? (
                                                <div className="flex items-center gap-1 text-success text-sm">
                                                    <Check className="h-4 w-4" />
                                                    Primary
                                                </div>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">Secondary</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setEditingLocation({ ...location })}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => deleteLocation(location.id)}
                                                    className="text-destructive hover:text-destructive"
                                                    disabled={location.isMain}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredLocations.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                            No locations found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Add Location Dialog */}
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Location</DialogTitle>
                            <DialogDescription>Add a new warehouse or branch.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Location Name *</Label>
                                <Input
                                    id="name"
                                    value={newLocation.name}
                                    onChange={(e) => setNewLocation(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g. Main Warehouse"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="address">Address</Label>
                                <Input
                                    id="address"
                                    value={newLocation.address}
                                    onChange={(e) => setNewLocation(prev => ({ ...prev, address: e.target.value }))}
                                    placeholder="123 Street, City"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Primary Location</Label>
                                    <p className="text-xs text-muted-foreground italic">Set as the default location for operations</p>
                                </div>
                                <Switch
                                    checked={newLocation.isMain}
                                    onCheckedChange={(checked) => setNewLocation(prev => ({ ...prev, isMain: checked }))}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                            <Button onClick={handleAddLocation} disabled={!newLocation.name || isSubmitting}>
                                {isSubmitting ? 'Adding...' : 'Add Location'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit Location Dialog */}
                <Dialog open={!!editingLocation} onOpenChange={() => setEditingLocation(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Location</DialogTitle>
                            <DialogDescription>Update location details.</DialogDescription>
                        </DialogHeader>
                        {editingLocation && (
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-name">Location Name *</Label>
                                    <Input
                                        id="edit-name"
                                        value={editingLocation.name}
                                        onChange={(e) => setEditingLocation(prev => prev ? { ...prev, name: e.target.value } : null)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-address">Address</Label>
                                    <Input
                                        id="edit-address"
                                        value={editingLocation.address || ''}
                                        onChange={(e) => setEditingLocation(prev => prev ? { ...prev, address: e.target.value } : null)}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label>Primary Location</Label>
                                        <p className="text-xs text-muted-foreground italic">Set as the default location for operations</p>
                                    </div>
                                    <Switch
                                        checked={editingLocation.isMain}
                                        onCheckedChange={(checked) => setEditingLocation(prev => prev ? { ...prev, isMain: checked } : null)}
                                    />
                                </div>
                            </div>
                        )}
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditingLocation(null)} disabled={isSubmitting}>Cancel</Button>
                            <Button onClick={handleUpdateLocation} disabled={!editingLocation?.name || isSubmitting}>
                                {isSubmitting ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
