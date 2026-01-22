import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { mockProducts } from '@/data/mockData';
import { getStockStatus } from '@/types/inventory';
import { StockBadge } from '@/components/inventory/StockBadge';
import { Search, Filter, ArrowUpDown, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';

type SortField = 'name' | 'sku' | 'stock' | 'price';
type SortOrder = 'asc' | 'desc';
type StockFilter = 'all' | 'in-stock' | 'low-stock' | 'out-of-stock';

export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Flatten all variants with product info
  const allVariants = mockProducts.flatMap(product =>
    product.variants.map(variant => ({
      ...variant,
      productName: product.name,
      category: product.category,
      status: getStockStatus(variant.stock, variant.lowStockThreshold)
    }))
  );

  // Filter variants
  const filteredVariants = allVariants.filter(variant => {
    const matchesSearch = 
      variant.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      variant.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      variant.barcode.includes(searchQuery);
    
    const matchesStock = 
      stockFilter === 'all' ||
      variant.status === stockFilter;
    
    return matchesSearch && matchesStock;
  });

  // Sort variants
  const sortedVariants = [...filteredVariants].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'name':
        comparison = a.productName.localeCompare(b.productName);
        break;
      case 'sku':
        comparison = a.sku.localeCompare(b.sku);
        break;
      case 'stock':
        comparison = a.stock - b.stock;
        break;
      case 'price':
        comparison = a.price - b.price;
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Stats
  const totalItems = allVariants.reduce((sum, v) => sum + v.stock, 0);
  const inStockCount = allVariants.filter(v => v.status === 'in-stock').length;
  const lowStockCount = allVariants.filter(v => v.status === 'low-stock').length;
  const outOfStockCount = allVariants.filter(v => v.status === 'out-of-stock').length;

  return (
    <AppLayout title="Inventory">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Items</p>
          <p className="text-2xl font-semibold">{totalItems.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">In Stock</p>
          <p className="text-2xl font-semibold text-success">{inStockCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Low Stock</p>
          <p className="text-2xl font-semibold text-warning">{lowStockCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Out of Stock</p>
          <p className="text-2xl font-semibold text-destructive">{outOfStockCount}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by product, SKU, or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as StockFilter)}>
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Stock Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="in-stock">In Stock</SelectItem>
            <SelectItem value="low-stock">Low Stock</SelectItem>
            <SelectItem value="out-of-stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <Button variant="ghost" size="sm" onClick={() => toggleSort('name')} className="font-medium">
                    Product
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </th>
                <th>
                  <Button variant="ghost" size="sm" onClick={() => toggleSort('sku')} className="font-medium">
                    SKU
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </th>
                <th>Barcode</th>
                <th>Attributes</th>
                <th>
                  <Button variant="ghost" size="sm" onClick={() => toggleSort('price')} className="font-medium">
                    Price
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </th>
                <th>
                  <Button variant="ghost" size="sm" onClick={() => toggleSort('stock')} className="font-medium">
                    Stock
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </th>
                <th>Threshold</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedVariants.map((variant) => (
                <tr key={variant.id} className="animate-fade-in">
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{variant.productName}</p>
                        <p className="text-xs text-muted-foreground">{variant.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="font-mono text-sm">{variant.sku}</td>
                  <td className="font-mono text-sm">{variant.barcode}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(variant.attributes).map(([key, value]) => (
                        <span key={key} className="text-xs bg-muted px-2 py-0.5 rounded">
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>${variant.price.toFixed(2)}</td>
                  <td className="font-semibold">{variant.stock}</td>
                  <td className="text-muted-foreground">{variant.lowStockThreshold}</td>
                  <td>
                    <StockBadge status={variant.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedVariants.length === 0 && (
          <div className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No items found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filters.</p>
          </div>
        )}
      </Card>
    </AppLayout>
  );
}
