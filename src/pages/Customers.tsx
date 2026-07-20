import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { Customer } from '@/types/inventory';
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
    TableRow
} from '@/components/ui/table';
import {
    Users,
    Edit,
    Plus,
    Trash2,
    Search,
    Mail,
    Phone,
    Calendar
} from 'lucide-react';
import { format } from 'date-fns';

export default function Customers() {
    const { customers, addCustomer, updateCustomer, deleteCustomer } = useInventory();

    const [searchQuery, setSearchQuery] = useState('');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [newCustomer, setNewCustomer] = useState({
        name: '',
        email: '',
        phone: '',
        idNumber: '',
        customerType: 'BOTH',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.phone && c.phone.includes(searchQuery))
    );

    const handleAddCustomer = async () => {
        if (!newCustomer.name || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await addCustomer({
                name: newCustomer.name,
                email: newCustomer.email,
                phone: newCustomer.phone,
                idNumber: newCustomer.idNumber,
                customerType: newCustomer.customerType,
            });

            setNewCustomer({ name: '', email: '', phone: '', idNumber: '', customerType: 'BOTH' });
            setIsAddDialogOpen(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateCustomer = async () => {
        if (!editingCustomer) return;
        await updateCustomer(editingCustomer);
        setEditingCustomer(null);
    };

    return (
        <AppLayout title="Customer Management">
            <div className="space-y-6">
                {/* Header Actions */}
                <div className="flex items-center justify-between">
                    <div className="relative w-80">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search customers..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Button onClick={() => setIsAddDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Customer
                    </Button>
                </div>

                {/* Customer Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Customers</CardTitle>
                        <CardDescription>View and manage your customer database.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Contact Information</TableHead>
                                    <TableHead>Joined Date</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredCustomers.map((customer) => (
                                    <TableRow key={customer.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                                    <Users className="h-5 w-5 text-primary" />
                                                </div>
                                                <p className="font-medium">{customer.name}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                                {customer.email && (
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <Mail className="h-3 w-3" />
                                                        {customer.email}
                                                    </div>
                                                )}
                                                {customer.phone && (
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <Phone className="h-3 w-3" />
                                                        {customer.phone}
                                                    </div>
                                                )}
                                                {customer.idNumber && (
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <span className="text-[10px] font-bold uppercase">ID:</span>
                                                        {customer.idNumber}
                                                    </div>
                                                )}
                                                {customer.customerType && (
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <span className="text-[10px] font-bold uppercase">Type:</span>
                                                        {customer.customerType}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Calendar className="h-3 w-3" />
                                                {format(new Date(customer.createdAt), 'PP')}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setEditingCustomer({ ...customer })}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => deleteCustomer(customer.id)}
                                                    className="text-destructive hover:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredCustomers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                            No customers found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Add Customer Dialog */}
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Customer</DialogTitle>
                            <DialogDescription>Create a new customer profile.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Full Name *</Label>
                                <Input
                                    id="name"
                                    value={newCustomer.name}
                                    onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="John Doe"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={newCustomer.email}
                                    onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                                    placeholder="john@example.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input
                                    id="phone"
                                    value={newCustomer.phone}
                                    onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                                    placeholder="+1 (555) 000-0000"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="idNumber">ID Number</Label>
                                <Input
                                    id="idNumber"
                                    value={newCustomer.idNumber}
                                    onChange={(e) => setNewCustomer(prev => ({ ...prev, idNumber: e.target.value }))}
                                    placeholder="Enter National ID or Passport"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="customerType">Customer Type</Label>
                                <Select 
                                    value={newCustomer.customerType} 
                                    onValueChange={(val) => setNewCustomer(prev => ({ ...prev, customerType: val }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="POS">POS Customer</SelectItem>
                                        <SelectItem value="ROOM">Room Customer</SelectItem>
                                        <SelectItem value="BOTH">Both</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleAddCustomer} disabled={!newCustomer.name || isSubmitting}>
                                {isSubmitting ? 'Adding...' : 'Add Customer'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit Customer Dialog */}
                <Dialog open={!!editingCustomer} onOpenChange={() => setEditingCustomer(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Customer</DialogTitle>
                            <DialogDescription>Update customer profile details.</DialogDescription>
                        </DialogHeader>
                        {editingCustomer && (
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-name">Full Name *</Label>
                                    <Input
                                        id="edit-name"
                                        value={editingCustomer.name}
                                        onChange={(e) => setEditingCustomer(prev => prev ? { ...prev, name: e.target.value } : null)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-email">Email Address</Label>
                                    <Input
                                        id="edit-email"
                                        type="email"
                                        value={editingCustomer.email || ''}
                                        onChange={(e) => setEditingCustomer(prev => prev ? { ...prev, email: e.target.value } : null)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-phone">Phone Number</Label>
                                    <Input
                                        id="edit-phone"
                                        value={editingCustomer.phone || ''}
                                        onChange={(e) => setEditingCustomer(prev => prev ? { ...prev, phone: e.target.value } : null)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-idNumber">ID Number</Label>
                                    <Input
                                        id="edit-idNumber"
                                        value={editingCustomer.idNumber || ''}
                                        onChange={(e) => setEditingCustomer(prev => prev ? { ...prev, idNumber: e.target.value } : null)}
                                        placeholder="Enter National ID or Passport"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-customerType">Customer Type</Label>
                                    <Select 
                                        value={editingCustomer.customerType || 'BOTH'} 
                                        onValueChange={(val) => setEditingCustomer(prev => prev ? { ...prev, customerType: val } : null)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select type..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="POS">POS Customer</SelectItem>
                                            <SelectItem value="ROOM">Room Customer</SelectItem>
                                            <SelectItem value="BOTH">Both</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditingCustomer(null)}>Cancel</Button>
                            <Button onClick={handleUpdateCustomer} disabled={!editingCustomer?.name}>Save Changes</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
