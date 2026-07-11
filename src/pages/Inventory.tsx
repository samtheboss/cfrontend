import { useState, Fragment } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { apiFetch, BASE_URL } from '@/lib/api';
import { getStockStatus } from '@/types/inventory';
import { StockBadge } from '@/components/inventory/StockBadge';
import { Search, Filter, ArrowUpDown, Package, ChevronDown, ChevronRight, Barcode } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';

type SortField = 'name' | 'sku' | 'stock' | 'price';
type SortOrder = 'asc' | 'desc';
type StockFilter = 'all' | 'in-stock' | 'low-stock' | 'out-of-stock';

export default function Inventory() {
  const { products, locations } = useInventory();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>(
    user?.locationId || locations.find(l => l.isMain)?.id || locations[0]?.id || 'all'
  );
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  const toggleExpand = (productId: string) => {
    const next = new Set(expandedProducts);
    if (next.has(productId)) {
      next.delete(productId);
    } else {
      next.add(productId);
    }
    setExpandedProducts(next);
  };

  // Filter products
  const filteredProducts = products.filter(product => {
    // Hidden if product is inactive
    if (product.isActive === false) return false;

    // Filter variants to only active ones
    const activeVariants = product.variants.filter(v => v.isActive !== false);
    if (activeVariants.length === 0) return false;

    const stock = selectedLocationId === 'all'
      ? activeVariants.reduce((sum, v) => sum + v.stock, 0)
      : activeVariants.reduce((sum, v) => sum + (v.locationStock[selectedLocationId] || 0), 0);

    const status = getStockStatus(stock, Math.min(...activeVariants.map(v => v.lowStockThreshold)));

    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activeVariants.some(v =>
        v.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.barcode.includes(searchQuery)
      );

    const matchesStock = stockFilter === 'all' || (
      stockFilter === 'in-stock' && stock > 0 ||
      stockFilter === 'low-stock' && status === 'low-stock' ||
      stockFilter === 'out-of-stock' && stock === 0
    );

    return matchesSearch && matchesStock;
  });

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'stock':
        const stockA = selectedLocationId === 'all' ? a.variants.reduce((sum, v) => sum + v.stock, 0) : a.variants.reduce((sum, v) => sum + (v.locationStock[selectedLocationId] || 0), 0);
        const stockB = selectedLocationId === 'all' ? b.variants.reduce((sum, v) => sum + v.stock, 0) : b.variants.reduce((sum, v) => sum + (v.locationStock[selectedLocationId] || 0), 0);
        comparison = stockA - stockB;
        break;
      case 'price':
        const priceA = Math.min(...a.variants.map(v => v.price));
        const priceB = Math.min(...b.variants.map(v => v.price));
        comparison = priceA - priceB;
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
  const getProductStock = (p: typeof products[0]) =>
    p.variants
      .filter(v => v.isActive !== false)
      .reduce((sum, v) => sum + (selectedLocationId === 'all' ? v.stock : v.locationStock[selectedLocationId] || 0), 0);

  const activeProducts = products.filter(p => p.isActive !== false);
  const totalItems = activeProducts.reduce((sum, p) => sum + getProductStock(p), 0);
  const inStockCount = activeProducts.filter(p => getProductStock(p) > 0).length;
  const lowStockCount = activeProducts.filter(p => {
    const activeVariants = p.variants.filter(v => v.isActive !== false);
    const stock = getProductStock(p);
    return stock > 0 && stock <= Math.min(...activeVariants.map(v => v.lowStockThreshold));
  }).length;
  const outOfStockCount = activeProducts.filter(p => getProductStock(p) === 0).length;

  return (
    <AppLayout title="Inventory">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Items</p>
          <p className="text-2xl font-semibold">{totalItems.toFixed(3)}</p>
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

        <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
          <SelectTrigger className="w-48">
            <Package className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations.map(loc => (
              <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

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
              {sortedProducts.map((product) => {
                const activeVariants = product.variants.filter(v => v.isActive !== false);
                const totalStock = selectedLocationId === 'all'
                  ? activeVariants.reduce((sum, v) => sum + v.stock, 0)
                  : activeVariants.reduce((sum, v) => sum + (v.locationStock[selectedLocationId] || 0), 0);

                const minPrice = Math.min(...activeVariants.map(v => v.price));
                const maxPrice = Math.max(...activeVariants.map(v => v.price));
                const priceRange = minPrice === maxPrice ? `$${minPrice.toFixed(2)}` : `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;

                return (
                  <Fragment key={product.id}>
                    <tr
                      key={product.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleExpand(product.id)}
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted overflow-hidden">
                            {product.images[0] ? (
                              <img
                                src={product.images[0].startsWith('http') ? product.images[0] : `${BASE_URL}${product.images[0]}`}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-sm font-medium text-muted-foreground">
                        {activeVariants.length} Variant{activeVariants.length !== 1 ? 's' : ''}
                      </td>
                      <td className="text-sm text-muted-foreground">-</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {product.attributes.map(attr => (
                            <Badge key={attr.id} variant="outline" className="text-[10px]">
                              {attr.name} ({attr.values.length})
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="font-medium">{priceRange}</td>
                      <td className="font-semibold">{totalStock.toFixed(3)}</td>
                      <td className="text-muted-foreground">-</td>
                      <td className="flex items-center justify-between">
                        <StockBadge status={getStockStatus(totalStock, 10)} />
                        {expandedProducts.has(product.id) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </td>
                    </tr>

                    {expandedProducts.has(product.id) && activeVariants.map(variant => {
                      const vStock = selectedLocationId === 'all'
                        ? variant.stock
                        : variant.locationStock[selectedLocationId] || 0;

                      return (
                        <tr key={variant.id} className="bg-muted/30 border-l-4 border-l-primary/50">
                          <td className="pl-12">
                            <div className="flex items-center gap-2">
                              <Barcode className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">Variant Detail</span>
                            </div>
                          </td>
                          <td className="font-mono text-xs">{variant.sku}</td>
                          <td className="font-mono text-xs">{variant.barcode}</td>
                          <td>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(variant.attributes).map(([key, value]) => (
                                <span key={key} className="text-[10px] bg-background border px-1.5 py-0.5 rounded">
                                  {key}: {value}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>${variant.price.toFixed(2)}</td>
                          <td className="font-semibold">{vStock.toFixed(3)}</td>
                          <td className="text-xs text-muted-foreground">{variant.lowStockThreshold.toFixed(3)}</td>
                          <td>
                            <StockBadge status={getStockStatus(vStock, variant.lowStockThreshold)} />
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {sortedProducts.length === 0 && (
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
