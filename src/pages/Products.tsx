import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { mockProducts } from '@/data/mockData';
import { Product, ProductAttribute, ProductVariant } from '@/types/inventory';
import { Plus, Search, MoreHorizontal, Package, ChevronDown, ChevronRight, Barcode, Edit, Trash2, Globe, Image as ImageIcon, X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { StockBadge } from '@/components/inventory/StockBadge';
import { getStockStatus } from '@/types/inventory';

const CATEGORIES = [
  'Apparel',
  'Footwear',
  'Accessories',
  'Electronics',
  'Home & Living',
  'Sports & Outdoors',
  'Beauty & Personal Care',
  'Food & Beverages',
];

export default function Products() {
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New product form state
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    category: '',
    attributes: [{ name: '', values: '' }] as { name: string; values: string }[],
    variants: [] as ProductVariant[],
    images: [] as string[],
    basePrice: '',
    baseCost: '',
    availableOnline: false,
  });



  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleExpand = (productId: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  };

  const generateSKU = (productName: string, attributes: Record<string, string>) => {
    const prefix = productName.substring(0, 3).toUpperCase();
    const attrPart = Object.values(attributes).map(v => v.substring(0, 3).toUpperCase()).join('-');
    return `${prefix}-${attrPart}`;
  };

  const generateBarcode = () => {
    return Math.floor(1000000000000 + Math.random() * 9000000000000).toString();
  };

  const addAttribute = () => {
    const newAttributes = [...newProduct.attributes, { name: '', values: '' }];
    handleAttributeChange(newAttributes);
  };

  const updateAttribute = (index: number, field: 'name' | 'values', value: string) => {
    const newAttributes = newProduct.attributes.map((attr, i) =>
      i === index ? { ...attr, [field]: value } : attr
    );
    handleAttributeChange(newAttributes);
  };

  const removeAttribute = (index: number) => {
    const newAttributes = newProduct.attributes.filter((_, i) => i !== index);
    handleAttributeChange(newAttributes);
  };

  const generateVariants = (attributes: ProductAttribute[], basePrice: number, baseCost: number, productId: string, productName: string): ProductVariant[] => {
    if (attributes.length === 0) return [];

    const combinations: Record<string, string>[] = [];

    const generateCombinations = (index: number, current: Record<string, string>) => {
      if (index === attributes.length) {
        combinations.push({ ...current });
        return;
      }
      const attr = attributes[index];
      for (const value of attr.values) {
        current[attr.name.toLowerCase()] = value;
        generateCombinations(index + 1, current);
      }
    };

    generateCombinations(0, {});

    return combinations.map((combo, i) => ({
      id: `${productId}-v${i}`,
      productId,
      sku: generateSKU(productName, combo),
      barcode: generateBarcode(),
      attributes: combo,
      price: basePrice,
      cost: baseCost,
      stock: 0,
      lowStockThreshold: 10
    }));
  };

  // Re-generate variants when attributes change, but try to preserve existing prices
  const updateVariantsFromAttributes = (
    currentAttributes: { name: string; values: string }[],
    currentBasePrice: string,
    currentBaseCost: string,
    currentVariants: ProductVariant[]
  ) => {
    const parsedAttributes = currentAttributes
      .filter(a => a.name && a.values)
      .map((a, i) => ({
        id: `attr${i}`,
        name: a.name,
        values: a.values.split(',').map(v => v.trim())
      }));

    if (parsedAttributes.length === 0) return [];

    const newVariants = generateVariants(
      parsedAttributes,
      parseFloat(currentBasePrice) || 0,
      parseFloat(currentBaseCost) || 0,
      'temp-id',
      newProduct.name || 'Product'
    );

    // Merge with existing to preserve manual edits if attribute combo matches
    return newVariants.map(nv => {
      const existing = currentVariants.find(ev =>
        JSON.stringify(ev.attributes) === JSON.stringify(nv.attributes)
      );
      if (existing) {
        return {
          ...nv,
          price: existing.price,
          cost: existing.cost,
          wasPrice: existing.wasPrice,
          stock: existing.stock
        };
      }
      return nv;
    });
  };

  const handleAttributeChange = (newAttributes: { name: string; values: string }[]) => {
    setNewProduct(prev => ({
      ...prev,
      attributes: newAttributes,
      variants: updateVariantsFromAttributes(newAttributes, prev.basePrice, prev.baseCost, prev.variants)
    }));
  };

  const handleBasePriceChange = (field: 'basePrice' | 'baseCost', value: string) => {
    setNewProduct(prev => {
      const newState = { ...prev, [field]: value };
      // Only update variants if they haven't been manually edited? 
      // Or just re-apply base price to all? 
      // Strategy: Re-generate all using new base, but checking if we should preserve.
      // Actually, usually changing base price should update all UNLESS specifically overridden.
      // For simplicity, let's just update all for now, or let the user edit individually.
      // Better: Update only if the variant price matched the OLD base price. 
      // Simpler approach for MVP: changing base price updates ALL variants.
      return {
        ...newState,
        variants: updateVariantsFromAttributes(newState.attributes, newState.basePrice, newState.baseCost, [])
      };
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setNewProduct(prev => ({
        ...prev,
        images: [...prev.images, url]
      }));
    }
  };

  const updateImage = (index: number, value: string) => {
    setNewProduct(prev => ({
      ...prev,
      images: prev.images.map((img, i) => i === index ? value : img)
    }));
  };

  const removeImage = (index: number) => {
    setNewProduct(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const resetForm = () => {
    setNewProduct({
      name: '',
      description: '',
      category: '',
      attributes: [{ name: '', values: '' }],
      variants: [],
      images: [],
      basePrice: '',
      baseCost: '',
      availableOnline: false,
    });
    setEditingId(null);
  };

  const handleEditProduct = (product: Product) => {
    setEditingId(product.id);
    setNewProduct({
      name: product.name,
      description: product.description,
      category: product.category,
      attributes: product.attributes.map(attr => ({
        name: attr.name,
        values: attr.values.join(', ')
      })),
      variants: product.variants,
      images: product.images || [],
      basePrice: product.variants[0]?.price.toString() || '',
      baseCost: product.variants[0]?.cost.toString() || '',
      availableOnline: product.availableOnline,
    });
    setIsAddDialogOpen(true);
  };

  const handleCreateProduct = () => {
    const productId = editingId || `p${Date.now()}`;
    const parsedAttributes: ProductAttribute[] = newProduct.attributes
      .filter(a => a.name && a.values)
      .map((a, i) => ({
        id: `attr${i}`,
        name: a.name,
        values: a.values.split(',').map(v => v.trim())
      }));



    // Use specific variants from state if they exist, otherwise generate (fallback)
    const variants = (newProduct.variants?.length || 0) > 0 ? newProduct.variants.map((v, i) => ({
      ...v,
      id: `${productId}-v${i}`,
      productId
    })) : generateVariants(
      parsedAttributes,
      parseFloat(newProduct.basePrice) || 0,
      parseFloat(newProduct.baseCost) || 0,
      productId,
      newProduct.name
    );

    const product: Product = {
      id: productId,
      name: newProduct.name,
      description: newProduct.description,
      category: newProduct.category,
      attributes: parsedAttributes,
      variants,
      images: newProduct.images.filter(img => img.trim() !== ''),
      availableOnline: newProduct.availableOnline,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (editingId) {
      setProducts(prev => prev.map(p => p.id === editingId ? product : p));
    } else {
      setProducts(prev => [...prev, product]);
    }

    resetForm();
    setIsAddDialogOpen(false);
  };

  return (
    <AppLayout title="Products">
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Product' : 'Create New Product'}</DialogTitle>
              <DialogDescription>
                {editingId ? 'Update product details and attributes.' : 'Add a new product with attributes. Variants will be auto-generated based on attributes.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Product Name</Label>
                <Input
                  id="name"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Classic Cotton T-Shirt"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={newProduct.description}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Product description..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={newProduct.category}
                  onValueChange={(value) => setNewProduct(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="price">Base Price ($)</Label>
                  <Input
                    id="price"
                    type="number"
                    value={newProduct.basePrice}
                    onChange={(e) => handleBasePriceChange('basePrice', e.target.value)}
                    placeholder="29.99"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cost">Base Cost ($)</Label>
                  <Input
                    id="cost"
                    type="number"
                    value={newProduct.baseCost}
                    onChange={(e) => handleBasePriceChange('baseCost', e.target.value)}
                    placeholder="12.00"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Attributes (for variant generation)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addAttribute}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Attribute
                  </Button>
                </div>
                {newProduct.attributes.map((attr, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Input
                        value={attr.name}
                        onChange={(e) => updateAttribute(index, 'name', e.target.value)}
                        placeholder="Attribute name (e.g., Size)"
                      />
                    </div>
                    <div className="flex-[2]">
                      <Input
                        value={attr.values}
                        onChange={(e) => updateAttribute(index, 'values', e.target.value)}
                        placeholder="Values separated by commas (e.g., S, M, L, XL)"
                      />
                    </div>
                    {newProduct.attributes.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAttribute(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <div className="space-y-3">
                  <Label>Generated Variants ({newProduct.variants?.length || 0})</Label>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-2 text-left">Variant</th>
                          <th className="p-2 w-24">Price</th>
                          <th className="p-2 w-24">Cost</th>
                          <th className="p-2 w-24">Was Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newProduct.variants?.map((variant, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-2">
                              {Object.entries(variant.attributes).map(([k, v]) => `${v}`).join(' / ')}
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                className="h-8"
                                value={variant.price}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setNewProduct(prev => ({
                                    ...prev,
                                    variants: prev.variants.map((v, i) => i === index ? { ...v, price: val } : v)
                                  }));
                                }}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                className="h-8"
                                value={variant.cost}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setNewProduct(prev => ({
                                    ...prev,
                                    variants: prev.variants.map((v, i) => i === index ? { ...v, cost: val } : v)
                                  }));
                                }}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                className="h-8"
                                placeholder="Optional"
                                value={variant.wasPrice || ''}
                                onChange={(e) => {
                                  const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                  setNewProduct(prev => ({
                                    ...prev,
                                    variants: prev.variants.map((v, i) => i === index ? { ...v, wasPrice: val } : v)
                                  }));
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                        {newProduct.variants.length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-muted-foreground">
                              Add attributes to generate variants
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Product Images</Label>
                  <label htmlFor="image-upload">
                    <Button type="button" variant="outline" size="sm" className="cursor-pointer" asChild>
                      <span>
                        <Upload className="h-3 w-3 mr-1" />
                        Upload Image
                      </span>
                    </Button>
                  </label>
                  <Input
                    id="image-upload"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                </div>
                {newProduct.images.length === 0 ? (
                  <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                    <ImageIcon className="h-8 w-8 opacity-50" />
                    <p className="text-sm">No images uploaded</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {newProduct.images.map((img, index) => (
                      <div key={index} className="relative group border rounded-lg overflow-hidden aspect-square bg-muted">
                        <img src={img} alt={`Product ${index + 1}`} className="w-full h-full object-cover" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeImage(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="availableOnline" className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    Available for E-commerce
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Enable this product for online sales and future e-commerce integration.
                  </p>
                </div>
                <Switch
                  id="availableOnline"
                  checked={newProduct.availableOnline}
                  onCheckedChange={(checked) => setNewProduct(prev => ({ ...prev, availableOnline: checked }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateProduct} disabled={!newProduct.name}>
                {editingId ? 'Update Product' : 'Create Product'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Products List */}
      <div className="space-y-4">
        {filteredProducts.map((product) => (
          <Card key={product.id} className="overflow-hidden">
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleExpand(product.id)}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 overflow-hidden">
                  {product.images && product.images.length > 0 ? (
                    <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium">{product.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {product.category} • {product.variants.length} variants
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex gap-2">
                  {product.availableOnline && (
                    <Badge variant="default" className="text-xs bg-primary/20 text-primary hover:bg-primary/30">
                      <Globe className="h-3 w-3 mr-1" />
                      E-commerce
                    </Badge>
                  )}
                  {product.attributes.map(attr => (
                    <Badge key={attr.id} variant="secondary" className="text-xs">
                      {attr.name}: {attr.values.length}
                    </Badge>
                  ))}
                  <Badge variant="outline" className="text-xs">
                    Total Qty: {product.variants.reduce((sum, v) => sum + v.stock, 0)}
                  </Badge>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Product
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Product
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {expandedProducts.has(product.id) ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Expanded Variants */}
            {expandedProducts.has(product.id) && (
              <div className="border-t bg-muted/30">
                <table className="data-table">
                  <thead>
                    <tr className="bg-muted/50">
                      <th>SKU</th>
                      <th>Barcode</th>
                      <th>Attributes</th>
                      <th>Price</th>
                      <th>Cost</th>
                      <th>Stock</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.variants.map((variant) => (
                      <tr key={variant.id}>
                        <td className="font-mono text-sm">{variant.sku}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Barcode className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono text-sm">{variant.barcode}</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex gap-1">
                            {Object.entries(variant.attributes).map(([key, value]) => (
                              <Badge key={key} variant="outline" className="text-xs">
                                {value}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td>${variant.price.toFixed(2)}</td>
                        <td>${variant.cost.toFixed(2)}</td>
                        <td>{variant.stock}</td>
                        <td>
                          <StockBadge status={getStockStatus(variant.stock, variant.lowStockThreshold)} />
                        </td>
                        <td>
                          <Button variant="ghost" size="sm">
                            <Barcode className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ))}

        {filteredProducts.length === 0 && (
          <Card className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No products found</h3>
            <p className="text-muted-foreground mb-4">Get started by adding your first product.</p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
