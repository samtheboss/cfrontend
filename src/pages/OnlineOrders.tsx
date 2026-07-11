import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '@/contexts/InventoryContext';
import { Sale, DeliveryStatus } from '@/types/inventory';
import {
    Package,
    Search,
    Filter,
    Eye,
    Truck,
    User,
    MapPin,
    Phone,
    Mail,
    Calendar,
    CheckCircle2,
    Clock,
    AlertCircle,
    ExternalLink,
    ChevronRight,
    MoreVertical,
    ClipboardList,
    Home,
    RotateCw
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';

export default function OnlineOrders() {
    const { salesHistory, updateTransaction, settings, refreshData, isLoading } = useInventory();
  const { sym } = useCurrency();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [selectedOrder, setSelectedOrder] = useState<Sale | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const navigate = useNavigate();

    // Filter sales to show only online orders
    const onlineOrders = useMemo(() => {
        return salesHistory.filter(sale =>
            sale.locationId === 'ONLINE' ||
            (sale as any).shippingLocation // Fallback if locationId isn't 'ONLINE' but has shipping
        ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [salesHistory]);

    const filteredOrders = useMemo(() => {
        return onlineOrders.filter(order => {
            const matchesSearch =
                order.journalNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (order.customerPhone || '').includes(searchQuery) ||
                (order.customerEmail || '').toLowerCase().includes(searchQuery.toLowerCase());

            const matchesStatus = statusFilter === 'ALL' || order.deliveryStatus === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [onlineOrders, searchQuery, statusFilter]);

    const getStatusColor = (status: string | undefined) => {
        switch (status) {
            case 'PENDING': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'PROCESSING': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'SHIPPED': return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'DELIVERED': return 'bg-green-100 text-green-800 border-green-200';
            case 'CANCELLED': return 'bg-red-100 text-red-800 border-red-200';
            case 'RETURNED': return 'bg-gray-100 text-gray-800 border-gray-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusIcon = (status: string | undefined) => {
        switch (status) {
            case 'PENDING': return <Clock className="h-3 w-3 mr-1" />;
            case 'PROCESSING': return <Package className="h-3 w-3 mr-1" />;
            case 'SHIPPED': return <Truck className="h-3 w-3 mr-1" />;
            case 'DELIVERED': return <CheckCircle2 className="h-3 w-3 mr-1" />;
            case 'CANCELLED': return <AlertCircle className="h-3 w-3 mr-1" />;
            default: return null;
        }
    };

    const handleUpdateStatus = async (status: string) => {
        if (!selectedOrder) return;

        setIsUpdating(true);
        try {
            await updateTransaction(selectedOrder.id, {
                ...selectedOrder,
                deliveryStatus: status as any
            });
            setSelectedOrder(prev => prev ? { ...prev, deliveryStatus: status as any } : null);
            toast.success(`Order status updated to ${status}`);
        } catch (error) {
            toast.error('Failed to update order status');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleUpdateTracking = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedOrder) return;

        const formData = new FormData(e.currentTarget);
        const trackingNumber = formData.get('trackingNumber') as string;
        const courierName = formData.get('courierName') as string;

        setIsUpdating(true);
        try {
            await updateTransaction(selectedOrder.id, {
                ...selectedOrder,
                trackingNumber,
                courierName
            });
            setSelectedOrder(prev => prev ? { ...prev, trackingNumber, courierName } : null);
            toast.success('Tracking information updated');
        } catch (error) {
            toast.error('Failed to update tracking information');
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => navigate('/')}
                        className="h-10 w-10 shrink-0"
                    >
                        <Home className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <Truck className="h-8 w-8 text-primary" />
                            Online Sales & Deliveries
                        </h1>
                        <p className="text-muted-foreground mt-1">Manage eCommerce orders and track shipping progress.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            refreshData();
                            toast.success('Refreshing orders...');
                        }}
                        disabled={isLoading}
                        className="h-9 px-3"
                    >
                        <RotateCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                        Refresh
                    </Button>
                    <Badge variant="outline" className="px-3 py-1 text-sm font-medium border-primary/20 bg-primary/5">
                        {onlineOrders.length} Total Orders
                    </Badge>
                    <Badge variant="outline" className="px-3 py-1 text-sm font-medium border-yellow-200 bg-yellow-50 text-yellow-800">
                        {onlineOrders.filter(o => o.deliveryStatus === 'PENDING').length} Pending
                    </Badge>
                </div>
            </div>

            <Card className="border-none shadow-sm bg-muted/30">
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by Order #, Phone, or Email..."
                                className="pl-9 h-10 bg-background"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2 min-w-[200px]">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="h-10 bg-background">
                                    <SelectValue placeholder="All Statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Statuses</SelectItem>
                                    <SelectItem value="PENDING">Pending</SelectItem>
                                    <SelectItem value="PROCESSING">Processing</SelectItem>
                                    <SelectItem value="SHIPPED">Shipped</SelectItem>
                                    <SelectItem value="DELIVERED">Delivered</SelectItem>
                                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                    <SelectItem value="RETURNED">Returned</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[150px]">Order #</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Delivery Status</TableHead>
                            <TableHead>Courier / Tracking</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredOrders.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <ClipboardList className="h-8 w-8 opacity-20" />
                                        <p>No online orders found</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredOrders.map((order) => (
                                <TableRow key={order.id} className="cursor-pointer hover:bg-muted/30 transition-colors group">
                                    <TableCell className="font-mono text-xs font-bold text-primary">
                                        {order.journalNumber}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        <div className="flex flex-col">
                                            <span className="font-medium">{format(new Date(order.timestamp), 'MMM dd, yyyy')}</span>
                                            <span className="text-muted-foreground">{format(new Date(order.timestamp), 'HH:mm')}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-sm">{order.customerPhone || 'N/A'}</span>
                                            <span className="text-xs text-muted-foreground truncate max-w-[150px]">{order.customerEmail || ''}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-bold">
                                        {settings?.currency || '$'}{order.totalAmount.toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn("flex items-center w-fit", getStatusColor(order.deliveryStatus))}>
                                            {getStatusIcon(order.deliveryStatus)}
                                            {order.deliveryStatus || 'PENDING'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {order.trackingNumber ? (
                                            <div className="flex flex-col">
                                                <span className="font-medium">{order.courierName || 'Standard'}</span>
                                                <span className="text-muted-foreground select-all">{order.trackingNumber}</span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground italic">No tracking info</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="group-hover:bg-primary/10 transition-colors"
                                            onClick={() => {
                                                setSelectedOrder(order);
                                                setIsDetailsOpen(true);
                                            }}
                                        >
                                            <Eye className="h-4 w-4 text-primary" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            {/* Order Details Dialog */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-none shadow-2xl">
                    {selectedOrder && (
                        <>
                            <DialogHeader className="p-6 bg-primary text-primary-foreground">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <Badge className="bg-white/20 hover:bg-white/30 text-white border-white/20 mb-2">
                                            Order {selectedOrder.journalNumber}
                                        </Badge>
                                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                            Order Details
                                        </DialogTitle>
                                        <DialogDescription className="text-primary-foreground/80 mt-1">
                                            Placed on {format(new Date(selectedOrder.timestamp), 'MMMM dd, yyyy at HH:mm')}
                                        </DialogDescription>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs uppercase tracking-wider opacity-70">Total Amount</p>
                                        <p className="text-3xl font-black">{settings?.currency || '$'}{selectedOrder.totalAmount.toLocaleString()}</p>
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 bg-background">
                                {/* Left Column: Customer & Shipping */}
                                <div className="md:col-span-1 p-6 space-y-8 border-r bg-muted/10">
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                            <User className="h-4 w-4" /> Customer Info
                                        </h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                    <Phone className="h-4 w-4" />
                                                </div>
                                                <span className="font-semibold text-sm">{selectedOrder.customerPhone || 'N/A'}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                    <Mail className="h-4 w-4" />
                                                </div>
                                                <span className="text-xs text-muted-foreground break-all">{selectedOrder.customerEmail || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <Separator />

                                    <div className="space-y-4">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                            <MapPin className="h-4 w-4" /> Shipping Address
                                        </h3>
                                        <div className="space-y-1 bg-card p-4 rounded-xl border shadow-sm">
                                            <p className="font-bold text-sm">{selectedOrder.customerPhone || 'Customer'}</p>
                                            <p className="text-sm text-muted-foreground leading-relaxed italic">
                                                {selectedOrder.shippingAddress || 'No address provided'}
                                            </p>
                                            <p className="text-sm font-medium pt-2">
                                                {selectedOrder.shippingCity}{selectedOrder.shippingPostalCode ? `, ${selectedOrder.shippingPostalCode}` : ''}
                                            </p>
                                            <Badge variant="outline" className="mt-3 bg-primary/5 text-primary border-primary/20">
                                                {selectedOrder.shippingLocation || 'Standard Shipping'}
                                            </Badge>
                                        </div>
                                    </div>

                                    <Separator />

                                    <div className="space-y-4">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                            <Truck className="h-4 w-4" /> Delivery Status
                                        </h3>
                                        <div className="space-y-3">
                                            <Select
                                                defaultValue={selectedOrder.deliveryStatus || 'PENDING'}
                                                onValueChange={handleUpdateStatus}
                                                disabled={isUpdating}
                                            >
                                                <SelectTrigger className="w-full h-11 font-bold">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="PENDING" className="font-medium text-yellow-600">Pending</SelectItem>
                                                    <SelectItem value="PROCESSING" className="font-medium text-blue-600">Processing</SelectItem>
                                                    <SelectItem value="SHIPPED" className="font-medium text-purple-600">Shipped</SelectItem>
                                                    <SelectItem value="DELIVERED" className="font-medium text-green-600">Delivered</SelectItem>
                                                    <SelectItem value="CANCELLED" className="font-medium text-red-600">Cancelled</SelectItem>
                                                    <SelectItem value="RETURNED" className="font-medium text-gray-600">Returned</SelectItem>
                                                </SelectContent>
                                            </Select>

                                            <p className="text-[10px] text-muted-foreground text-center">
                                                Updating status will reflect in customer history.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Order Items & Tracking */}
                                <div className="md:col-span-2 p-6 flex flex-col space-y-8">
                                    <div className="flex-1 space-y-4">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                            <Package className="h-4 w-4" /> Order Items
                                        </h3>
                                        <div className="border rounded-xl overflow-hidden shadow-sm">
                                            <Table>
                                                <TableHeader className="bg-muted/50">
                                                    <TableRow>
                                                        <TableHead className="text-xs">Product Details</TableHead>
                                                        <TableHead className="text-center text-xs">Qty</TableHead>
                                                        <TableHead className="text-right text-xs">Unit Price</TableHead>
                                                        <TableHead className="text-right text-xs">Subtotal</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedOrder.items.map((item, idx) => (
                                                        <TableRow key={idx}>
                                                            <TableCell>
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold text-sm">{item.productName}</span>
                                                                    <span className="text-[10px] text-muted-foreground uppercase font-mono">{item.sku}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-center font-bold">x{Math.abs(item.adjustment)}</TableCell>
                                                            <TableCell className="text-right">
                                                                {settings?.currency || '$'}{(item.unitPrice || item.price || 0).toLocaleString()}
                                                            </TableCell>
                                                            <TableCell className="text-right font-black">
                                                                {settings?.currency || '$'}{((item.unitPrice || item.price || 0) * Math.abs(item.adjustment)).toLocaleString()}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>

                                        <div className="flex flex-col items-end pt-2 pr-4 space-y-1">
                                            <div className="flex justify-between w-[200px] text-sm text-muted-foreground">
                                                <span>Items Subtotal</span>
                                                <span>{settings?.currency || '$'}{(selectedOrder.subtotal || selectedOrder.totalAmount - (selectedOrder.shippingFee || 0)).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between w-[200px] text-sm text-green-600">
                                                <span>Shipping Fee</span>
                                                <span>{settings?.currency || '$'}{(selectedOrder.shippingFee || 0).toLocaleString()}</span>
                                            </div>
                                            <Separator className="w-[200px] my-2" />
                                            <div className="flex justify-between w-[200px] text-lg font-black text-primary">
                                                <span>Grand Total</span>
                                                <span>{settings?.currency || '$'}{selectedOrder.totalAmount.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <Card className="border-primary/20 bg-primary/5 shadow-inner">
                                        <CardHeader className="p-4 pb-2">
                                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                                <Truck className="h-4 w-4 text-primary" /> Tracking Information
                                            </CardTitle>
                                            <CardDescription className="text-xs">Enter details to keep the customer informed.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0">
                                            <form onSubmit={handleUpdateTracking} className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                                <div className="md:col-span-2 space-y-1">
                                                    <label className="text-[10px] font-bold uppercase opacity-60">Courier Name</label>
                                                    <Input
                                                        name="courierName"
                                                        placeholder="e.g. FedEx, G4S"
                                                        defaultValue={selectedOrder.courierName}
                                                        className="h-10 bg-background"
                                                    />
                                                </div>
                                                <div className="md:col-span-2 space-y-1">
                                                    <label className="text-[10px] font-bold uppercase opacity-60">Tracking Number</label>
                                                    <Input
                                                        name="trackingNumber"
                                                        placeholder="Enter #..."
                                                        defaultValue={selectedOrder.trackingNumber}
                                                        className="h-10 bg-background"
                                                    />
                                                </div>
                                                <div className="flex items-end">
                                                    <Button type="submit" className="w-full h-10 font-bold" disabled={isUpdating}>
                                                        {isUpdating ? '...' : (selectedOrder.trackingNumber ? 'Update' : 'Add')}
                                                    </Button>
                                                </div>
                                            </form>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>

                            <DialogFooter className="p-4 bg-muted/20 border-t">
                                <Button variant="outline" onClick={() => setIsDetailsOpen(false)} className="h-11 px-8 font-bold">
                                    Close Details
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div >
    );
}

// Utility class helper
function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}
