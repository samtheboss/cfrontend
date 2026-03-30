import { useState, Fragment } from 'react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { History, ArrowRight, ChevronDown, ChevronRight, Package, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InventoryTransactions() {
    const { transactions, locations } = useInventory();
    const [expandedJournals, setExpandedJournals] = useState<Set<string>>(new Set());
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

    const toggleJournal = (id: string) => {
        const next = new Set(expandedJournals);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedJournals(next);
    };

    const toggleProduct = (journalId: string, productName: string) => {
        const key = `${journalId}-${productName}`;
        const next = new Set(expandedProducts);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setExpandedProducts(next);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'RECEIVED':
            case 'COMPLETED': return 'bg-success/10 text-success border-success/20';
            case 'PENDING': return 'bg-warning/10 text-warning border-warning/20';
            case 'CANCELLED': return 'bg-destructive/10 text-destructive border-destructive/20';
            default: return '';
        }
    };

    const sortedTransactions = [...transactions].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return (
        <AppLayout title="Transaction Journal">
            <div className="space-y-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <History className="h-5 w-5 text-primary" />
                            Audit Trail
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th className="w-10"></th>
                                    <th>Journal #</th>
                                    <th>Date & Time</th>
                                    <th>Type</th>
                                    <th>Status</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedTransactions.map((tr) => {
                                    const isExpanded = expandedJournals.has(tr.id!);
                                    const groupedItems = tr.items.reduce((acc, item) => {
                                        if (!acc[item.productName]) acc[item.productName] = [];
                                        acc[item.productName].push(item);
                                        return acc;
                                    }, {} as Record<string, any[]>);

                                    return (
                                        <Fragment key={tr.id}>
                                            <tr
                                                className={cn(
                                                    "cursor-pointer hover:bg-muted/50 transition-colors",
                                                    isExpanded && "bg-muted/30"
                                                )}
                                                onClick={() => toggleJournal(tr.id!)}
                                            >
                                                <td className="text-center">
                                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </td>
                                                <td className="font-mono font-bold text-sm text-primary">{tr.journalNumber}</td>
                                                <td className="text-sm">
                                                    {format(new Date(tr.timestamp), 'MMM d, yyyy HH:mm')}
                                                </td>
                                                <td>
                                                    <Badge variant="outline" className="text-[10px] uppercase font-bold">
                                                        {tr.type.replace('_', ' ')}
                                                    </Badge>
                                                </td>
                                                <td>
                                                    <Badge
                                                        variant="outline"
                                                        className={cn("capitalize", getStatusColor(tr.status))}
                                                    >
                                                        {tr.status.toLowerCase()}
                                                    </Badge>
                                                </td>
                                                <td className="max-w-xs truncate text-sm text-muted-foreground">
                                                    {tr.notes || '---'}
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-muted/10">
                                                    <td colSpan={6} className="p-0 border-t-0">
                                                        <div className="px-14 py-4 space-y-3">
                                                            {/* Header Info */}
                                                            <div className="flex gap-8 text-xs text-muted-foreground mb-4 pb-2 border-b">
                                                                {(tr as any).locationId && (
                                                                    <div>
                                                                        <span className="uppercase font-semibold mr-2 text-[10px]">Location:</span>
                                                                        <span className="text-foreground">{locations.find(l => l.id === (tr as any).locationId)?.name}</span>
                                                                    </div>
                                                                )}
                                                                {(tr as any).fromLocationId && (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="uppercase font-semibold text-[10px]">Route:</span>
                                                                        <span className="text-foreground">{locations.find(l => l.id === (tr as any).fromLocationId)?.name}</span>
                                                                        <ArrowRight className="h-3 w-3" />
                                                                        <span className="text-foreground">{locations.find(l => l.id === (tr as any).toLocationId)?.name}</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Product Groups */}
                                                            <div className="space-y-2">
                                                                {Object.entries(groupedItems).map(([productName, variants]) => {
                                                                    const productKey = `${tr.id}-${productName}`;
                                                                    const isProductExpanded = expandedProducts.has(productKey);

                                                                    return (
                                                                        <div key={productName} className="border rounded-md overflow-hidden bg-white shadow-sm">
                                                                            <div
                                                                                className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/50"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    toggleProduct(tr.id!, productName);
                                                                                }}
                                                                            >
                                                                                <div className="flex items-center gap-2 text-sm font-semibold">
                                                                                    <Package className="h-4 w-4 text-primary" />
                                                                                    {productName}
                                                                                    <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-2">
                                                                                        {variants.length} items
                                                                                    </Badge>
                                                                                </div>
                                                                                {isProductExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                                            </div>

                                                                            {isProductExpanded && (
                                                                                <div className="border-t bg-muted/5 divide-y divide-dashed">
                                                                                    <div className="grid grid-cols-4 gap-4 px-4 py-1.5 text-[10px] font-bold text-muted-foreground uppercase bg-muted/20">
                                                                                        <div>Variant SKU</div>
                                                                                        <div className="text-center">Before</div>
                                                                                        <div className="text-center">Change</div>
                                                                                        <div className="text-center">After</div>
                                                                                    </div>
                                                                                    {variants.map((v, idx) => (
                                                                                        <div key={idx} className="grid grid-cols-4 gap-4 px-4 py-2 items-center text-sm">
                                                                                            <div className="font-mono text-xs text-muted-foreground">{v.sku}</div>
                                                                                            <div className="text-center">{v.quantityBefore != null ? v.quantityBefore.toFixed(3) : '-'}</div>
                                                                                            <div className="flex justify-center">
                                                                                                <Badge variant={v.adjustment > 0 ? 'default' : v.adjustment < 0 ? 'destructive' : 'secondary'} className="h-5 text-[10px] font-bold">
                                                                                                    {v.adjustment > 0 ? '+' : ''}{v.adjustment.toFixed(3)}
                                                                                                </Badge>
                                                                                            </div>
                                                                                            <div className="text-center font-bold text-primary">{v.quantityAfter != null ? v.quantityAfter.toFixed(3) : '-'}</div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                        {transactions.length === 0 && (
                            <div className="text-center py-20 text-muted-foreground">
                                <FileText className="h-10 w-10 mx-auto mb-4 opacity-20" />
                                No inventory transactions recorded yet.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
