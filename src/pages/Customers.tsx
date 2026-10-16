import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { Customer } from '@/types/inventory';
import { useCurrency } from '@/hooks/useCurrency';
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
    Users,
    Edit,
    Plus,
    Trash2,
    Search,
    BookOpen
} from 'lucide-react';

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
        creditLimit: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const navigate = useNavigate();
    const { fmt } = useCurrency();
    const [typeFilter, setTypeFilter] = useState('ALL');

    const filteredCustomers = customers.filter(c => {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch = !q ||
            c.name.toLowerCase().includes(q) ||
            (c.email && c.email.toLowerCase().includes(q)) ||
            (c.phone && c.phone.includes(q)) ||
            (c.idNumber && c.idNumber.toLowerCase().includes(q));

        const matchesType = typeFilter === 'ALL' || c.customerType === typeFilter;
        return matchesSearch && matchesType;
    });

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
                creditLimit: newCustomer.creditLimit ? Number(newCustomer.creditLimit) : undefined,
            });

            setNewCustomer({ name: '', email: '', phone: '', idNumber: '', customerType: 'BOTH', creditLimit: '' });
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
            <div className="space-y-4">
                {/* Header Actions */}
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                    <div className="flex flex-1 items-center gap-2 max-w-md">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search customers..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-10"
                            />
                        </div>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-36 h-10">
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Types</SelectItem>
                                <SelectItem value="ONLINE">Ecommerce / Online</SelectItem>
                                <SelectItem value="POS">POS</SelectItem>
                                <SelectItem value="ROOM">Room</SelectItem>
                                <SelectItem value="BOTH">Both</SelectItem>
                                <SelectItem value="TENANT">Tenant</SelectItem>
                                <SelectItem value="WHOLESALE">Wholesale</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="text-xs text-muted-foreground hidden md:block mr-2">
                            Showing <span className="font-semibold text-foreground">{filteredCustomers.length}</span> of {customers.length}
                        </div>
                        <Button onClick={() => setIsAddDialogOpen(true)} className="gap-1.5 h-10">
                            <Plus className="h-4 w-4" />
                            Add Customer
                        </Button>
                    </div>
                </div>

                {/* Customer Cards Grid */}
                {filteredCustomers.length === 0 ? (
                    <div className="text-center py-16 border-2 border-dashed rounded-xl text-muted-foreground">
                        <Users className="h-10 w-10 mx-auto opacity-20 mb-3" />
                        <p className="font-medium">No customers found</p>
                        <p className="text-sm mt-1">Try adjusting your search or add a new customer.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {filteredCustomers.map((customer) => {
                            const initials = customer.name
                                .split(' ')
                                .filter(Boolean)
                                .slice(0, 2)
                                .map(w => w[0])
                                .join('')
                                .toUpperCase() || 'C';

                            const colors = [
                                'from-violet-500 to-purple-600',
                                'from-blue-500 to-cyan-600',
                                'from-emerald-500 to-teal-600',
                                'from-orange-500 to-amber-600',
                                'from-rose-500 to-pink-600',
                                'from-indigo-500 to-blue-600',
                            ];
                            const colorClass = colors[Math.abs(Number(customer.id) || 0) % colors.length] || colors[0];

                            return (
                                <div
                                    key={customer.id}
                                    className="group relative flex flex-col bg-card border rounded-xl p-0 overflow-hidden hover:shadow-md hover:border-primary/40 transition-all duration-200"
                                >
                                    {/* Top colour strip */}
                                    <div className={`h-1.5 w-full bg-gradient-to-r ${colorClass}`} />
                                    <div className="flex items-start gap-3 p-3 pb-2">
                                        <div className={`flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br ${colorClass} flex items-center justify-center text-white text-sm font-bold shadow-sm`}>
                                            {initials}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <p className="font-semibold text-sm leading-tight truncate">{customer.name}</p>
                                                {customer.userId && (
                                                    <span className="text-[9px] font-medium bg-sky-500/10 text-sky-600 border border-sky-500/20 px-1 py-0.2 rounded shrink-0">Web</span>
                                                )}
                                            </div>
                                            {customer.idNumber && (
                                                <p className="text-xs text-muted-foreground truncate mt-0.5">ID: {customer.idNumber}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="px-3 pb-2 space-y-1 flex-1">
                                        {customer.email && (
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <span className="shrink-0 w-3.5 text-center">✉</span>
                                                <span className="truncate">{customer.email}</span>
                                            </div>
                                        )}
                                        {customer.phone && (
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <span className="shrink-0 w-3.5 text-center">📞</span>
                                                <span className="truncate">{customer.phone}</span>
                                            </div>
                                        )}
                                        {customer.creditLimit !== undefined && customer.creditLimit !== null && (
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <span className="shrink-0 w-3.5 text-center">💳</span>
                                                <span className="truncate">Limit: {fmt(customer.creditLimit)}</span>
                                            </div>
                                        )}
                                        {!customer.email && !customer.phone && !customer.idNumber && !customer.creditLimit && (
                                            <p className="text-xs text-muted-foreground/60 italic">No contact details</p>
                                        )}
                                    </div>

                                    {/* Footer */}
                                    <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30 mt-1">
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                            customer.customerType === 'ONLINE'
                                                ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300'
                                                : customer.customerType === 'WHOLESALE'
                                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                                                : customer.customerType === 'TENANT' || customer.customerType === 'ROOM'
                                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400'
                                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                        }`}>
                                            {customer.customerType === 'ONLINE' ? 'ONLINE / ECOMMERCE' : (customer.customerType || 'RETAIL')}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs px-2 gap-1 bg-background hover:bg-primary hover:text-primary-foreground transition-colors"
                                                onClick={() => navigate(`/customer-accounts?accountId=${customer.id}`)}
                                                title="Open customer ledger"
                                            >
                                                <BookOpen className="h-3 w-3" />
                                                Ledger
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => setEditingCustomer({ ...customer })}
                                                title="Edit customer"
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs px-1.5 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => deleteCustomer(customer.id)}
                                                title="Delete customer"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

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
                                        <SelectItem value="ONLINE">Ecommerce / Online</SelectItem>
                                        <SelectItem value="BOTH">Both</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="creditLimit">Credit Limit</Label>
                                <Input
                                    id="creditLimit"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={newCustomer.creditLimit}
                                    onChange={(e) => setNewCustomer(prev => ({ ...prev, creditLimit: e.target.value }))}
                                    placeholder="0.00"
                                />
                                <p className="text-xs text-muted-foreground">Maximum outstanding balance allowed on credit sales. Leave blank for no limit.</p>
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
                                            <SelectItem value="ONLINE">Ecommerce / Online</SelectItem>
                                            <SelectItem value="BOTH">Both</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-creditLimit">Credit Limit</Label>
                                    <Input
                                        id="edit-creditLimit"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={editingCustomer.creditLimit ?? ''}
                                        onChange={(e) => setEditingCustomer(prev => prev ? { ...prev, creditLimit: e.target.value ? Number(e.target.value) : undefined } : null)}
                                        placeholder="0.00"
                                    />
                                    <p className="text-xs text-muted-foreground">Maximum outstanding balance allowed on credit sales. Leave blank for no limit.</p>
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
