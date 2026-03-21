import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { mockProducts } from '@/data/mockData';
import { Product, ProductAttribute, ProductVariant } from '@/types/inventory';
import { Plus, Search, MoreHorizontal, Package, ChevronDown, ChevronRight, Barcode, Edit, Trash2, Globe, Image as ImageIcon, X, Upload, Star, RefreshCw } from 'lucide-react';
import { apiFetch, BASE_URL } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
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
import { useInventory } from '@/contexts/InventoryContext';
import { ImportProductsDialog } from '@/components/inventory/ImportProductsDialog';
import { Settings, Tag, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Categories are now managed in InventoryContext

export default function Products() {
  const {
    products: contextProducts,
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    addProduct: contextAddProduct,
    updateProduct: contextUpdateProduct,
    deleteProduct: contextDeleteProduct,
    deleteProducts: contextDeleteProducts
  } = useInventory();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>(contextProducts);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryImage, setNewCategoryImage] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [showDisabled, setShowDisabled] = useState(false);

  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ... (existing code omitted) ...



  // Sync with context products if they change
  useEffect(() => {
    setProducts(contextProducts);
  }, [contextProducts]);

  // New product form state
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    category: '',
    barcode: '',
    attributes: [{ name: '', values: '' }] as { name: string; values: string }[],
    variants: [] as ProductVariant[],
    images: [] as string[],
    basePrice: '',
    baseCost: '',
    availableOnline: false,
    isActive: true,
    isFeatured: false,
  });

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = showDisabled || p.isActive !== false;
    return matchesSearch && matchesStatus;
  });

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

  const generateVariants = (attributes: ProductAttribute[], basePrice: number, baseCost: number, productId: string, productName: string, manualBarcode?: string): ProductVariant[] => {
    if (attributes.length === 0) {
      // Create a single default variant with the base price/cost
      return [{
        id: `${productId}-v0`,
        productId,
        sku: generateSKU(productName, {}),
        barcode: manualBarcode || generateBarcode(),
        attributes: {},
        price: basePrice,
        cost: baseCost,
        stock: 0,
        locationStock: {},
        lowStockThreshold: 10,
        isActive: true
      }];
    }
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
      barcode: manualBarcode || generateBarcode(),
      attributes: combo,
      price: basePrice,
      cost: baseCost,
      stock: 0,
      locationStock: {},
      lowStockThreshold: 10,
      isActive: true
    }));
  };

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

    // Check if all attributes in 'subset' exist in 'superset' with same values
    const isAttributeSubset = (subset: Record<string, string>, superset: Record<string, string>) => {
      return Object.entries(subset).every(([key, value]) =>
        superset[key.toLowerCase()] === value || superset[key] === value
      );
    };

    // Exact match check
    const areAttributesEqual = (a: Record<string, string>, b: Record<string, string>) => {
      const keysA = Object.keys(a).sort();
      const keysB = Object.keys(b).sort();
      if (keysA.length !== keysB.length) return false;
      return keysA.every((key, i) => key === keysB[i] && a[key] === b[key]);
    };

    return newVariants.map(nv => {
      // Priority 1: Exact match by attributes
      let existing = currentVariants.find(ev => areAttributesEqual(ev.attributes, nv.attributes));

      // Priority 2: Partial match - if existing variant's attributes are a subset of the new variant
      // This handles the case when a new attribute is added (e.g., adding "Color" when only "Size" existed)
      if (!existing) {
        existing = currentVariants.find(ev =>
          Object.keys(ev.attributes).length > 0 && isAttributeSubset(ev.attributes, nv.attributes)
        );
      }

      // Priority 3: Match by SKU if attributes don't match (prevents ID loss on SKU edits)
      if (!existing && nv.sku) {
        existing = currentVariants.find(ev => ev.sku === nv.sku);
      }

      if (existing) {
        return {
          ...nv,
          id: existing.id,
          price: (nv.price === 0 && existing.price > 0) ? existing.price : nv.price,
          cost: (nv.cost === 0 && existing.cost > 0) ? existing.cost : nv.cost,
          wasPrice: existing.wasPrice,
          stock: existing.stock,
          locationStock: existing.locationStock,
          lowStockThreshold: existing.lowStockThreshold || nv.lowStockThreshold,
          isActive: existing.isActive !== undefined ? existing.isActive : true
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
      return {
        ...newState,
        variants: updateVariantsFromAttributes(newState.attributes, newState.basePrice, newState.baseCost, [])
      };
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let files: FileList | null = null;

    if ('target' in e && e.target instanceof HTMLInputElement) {
      files = e.target.files;
    } else if ('dataTransfer' in e) {
      e.preventDefault();
      setIsDragging(false);
      files = e.dataTransfer.files;
    }

    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    for (const file of fileArray) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await apiFetch<{ url: string }>('/api/upload', {
          method: 'POST',
          body: formData,
        });

        setNewProduct(prev => ({
          ...prev,
          images: [...prev.images, response.url]
        }));
      } catch (error) {
        console.error('Upload error:', error);
      }
    }
  };

  const handleVariantImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiFetch<{ url: string }>('/api/upload', {
        method: 'POST',
        body: formData,
      });

      setNewProduct(prev => ({
        ...prev,
        variants: prev.variants.map((v, i) => i === index ? { ...v, image: response.url } : v)
      }));
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: "Could not upload variant image.",
        variant: "destructive"
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const moveImage = (dragIndex: number, hoverIndex: number) => {
    setNewProduct(prev => {
      const newImages = [...prev.images];
      const draggedImage = newImages[dragIndex];
      newImages.splice(dragIndex, 1);
      newImages.splice(hoverIndex, 0, draggedImage);
      return { ...prev, images: newImages };
    });
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
      barcode: '',
      attributes: [{ name: '', values: '' }],
      variants: [],
      images: [],
      basePrice: '',
      baseCost: '',
      availableOnline: false,
      isActive: true,
      isFeatured: false,
    });
    setEditingId(null);
  };

  const handleEditProduct = (product: Product) => {
    setEditingId(product.id);
    setNewProduct({
      name: product.name,
      description: product.description,
      category: product.category,
      barcode: product.variants[0]?.barcode || '',
      attributes: product.attributes.map(attr => ({
        name: attr.name,
        values: attr.values.join(', ')
      })),
      variants: product.variants,
      images: (product.images || []).map(img => img.replace(BASE_URL, '')),
      basePrice: product.variants[0]?.price.toString() || '',
      baseCost: product.variants[0]?.cost.toString() || '',
      availableOnline: product.availableOnline,
      isActive: product.isActive !== undefined ? product.isActive : true,
      isFeatured: !!product.isFeatured,
    });
    setIsAddDialogOpen(true);
  };

  const handleCreateProduct = async () => {
    setIsSubmitting(true);
    try {
      const productId = editingId || `p${Date.now()}`;
      const parsedAttributes: any[] = newProduct.attributes
        .filter(a => a.name && a.values)
        .map((a, i) => ({
          id: undefined,
          name: a.name,
          values: a.values.split(',').map(v => v.trim())
        }));

      const isNumeric = (val: any) => {
        if (val === null || val === undefined) return false;
        const num = Number(val);
        return !isNaN(num) && num > 0; // Backend IDs are positive Longs
      };

      const sanitizeId = (id: any) => isNumeric(id) ? (typeof id === 'string' ? parseInt(id) : id) : undefined;

      const variants = (newProduct.variants?.length || 0) > 0 ? newProduct.variants.map((v, i) => ({
        ...v,
        id: sanitizeId(v.id),
        productId: sanitizeId(editingId),
        isActive: v.isActive !== false
      })) : generateVariants(
        parsedAttributes,
        parseFloat(newProduct.basePrice) || 0,
        parseFloat(newProduct.baseCost) || 0,
        productId,
        newProduct.name,
        newProduct.barcode || undefined
      ).map(v => ({ ...v, id: undefined, productId: sanitizeId(editingId) }));

      const productData: any = {
        id: sanitizeId(editingId),
        name: newProduct.name,
        description: newProduct.description,
        category: newProduct.category,
        attributes: parsedAttributes,
        variants,
        images: newProduct.images.map(img => img.replace(BASE_URL, '')).filter(img => img.trim() !== ''),
        availableOnline: !!newProduct.availableOnline,
        isActive: newProduct.isActive !== false,
        isFeatured: !!newProduct.isFeatured,
      };

      if (editingId) {
        await contextUpdateProduct(productData);
      } else {
        await contextAddProduct(productData);
      }
      resetForm();
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error('Error creating/updating product:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      await contextDeleteProduct(productToDelete.id);
      setIsDeleteDialogOpen(false);
      setProductToDelete(null);
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const handleBulkDelete = async () => {
    try {
      await contextDeleteProducts(Array.from(selectedProductIds));
      setIsBulkDeleteDialogOpen(false);
      setSelectedProductIds(new Set());
    } catch (error) {
      console.error('Bulk delete error:', error);
    }
  };

  const handleCategoryParamsReset = () => {
    setNewCategoryName('');
    setNewCategoryImage('');
    setEditingCategoryId(null);
  }

  const handleCategoryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiFetch<{ url: string }>('/api/upload', {
        method: 'POST',
        body: formData,
      });
      setNewCategoryImage(response.url);
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: "Could not upload category image.",
        variant: "destructive"
      });
    }
  };

  return (
    <AppLayout title="Products">
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-3 h-10 border rounded-md bg-background">
            <Label htmlFor="show-disabled" className="text-xs font-medium cursor-pointer whitespace-nowrap">Show Disabled</Label>
            <Switch
              id="show-disabled"
              checked={showDisabled}
              onCheckedChange={setShowDisabled}
              className="scale-75"
            />
          </div>
          <ImportProductsDialog />
          <Button variant="outline" onClick={() => setIsCategoryDialogOpen(true)}>
            <Tag className="h-4 w-4 mr-2" />
            Categories
          </Button>
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
            <DialogContent className="w-[90vw] max-w-[90vw] md:max-w-2xl max-h-[85vh] flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>{editingId ? 'Edit Product' : 'Create New Product'}</DialogTitle>
                <DialogDescription>
                  {editingId ? 'Update product details and attributes.' : 'Add a new product with attributes. Variants will be auto-generated based on attributes.'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 overflow-y-auto flex-1">
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
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="price">Sell Price</Label>
                    <Input
                      id="price"
                      type="number"
                      value={newProduct.basePrice}
                      onChange={(e) => handleBasePriceChange('basePrice', e.target.value)}
                      placeholder="29.99"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cost">Buy Price</Label>
                    <Input
                      id="cost"
                      type="number"
                      value={newProduct.baseCost}
                      onChange={(e) => handleBasePriceChange('baseCost', e.target.value)}
                      placeholder="12.00"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="barcode">Barcode</Label>
                  <div className="flex gap-2">
                    <Input
                      id="barcode"
                      value={newProduct.barcode}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, barcode: e.target.value }))}
                      placeholder="Enter barcode or generate one"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => setNewProduct(prev => ({ ...prev, barcode: generateBarcode() }))}
                      title="Generate barcode"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
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
                    <div key={index} className="flex flex-col sm:flex-row gap-2 items-start border p-3 rounded-md sm:border-0 sm:p-0 relative">
                      <div className="w-full sm:flex-1">
                        <Label className="sm:hidden text-xs mb-1">Name</Label>
                        <Input
                          value={attr.name}
                          onChange={(e) => updateAttribute(index, 'name', e.target.value)}
                          placeholder="Attribute name (e.g., Size)"
                        />
                      </div>
                      <div className="w-full sm:flex-[2]">
                        <Label className="sm:hidden text-xs mb-1">Values</Label>
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
                          className="absolute -top-1 -right-1 sm:static h-8 w-8 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <div className="space-y-3">
                    <Label>Generated Variants ({newProduct.variants?.length || 0})</Label>

                    {/* Mobile Card Layout */}
                    <div className="md:hidden space-y-3">
                      {newProduct.variants?.map((variant, index) => (
                        <div key={index} className="border rounded-lg p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">
                              {Object.entries(variant.attributes).map(([k, v]) => `${v}`).join(' / ')}
                            </span>
                            <div className="flex items-center gap-2">
                              {variant.image ? (
                                <div className="relative h-8 w-8 rounded border overflow-hidden group">
                                  <img
                                    src={variant.image.startsWith('http') ? variant.image : `${BASE_URL}${variant.image}`}
                                    className="h-full w-full object-cover"
                                    alt=""
                                  />
                                  <button
                                    type="button"
                                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => {
                                      setNewProduct(prev => ({
                                        ...prev,
                                        variants: prev.variants.map((v, i) => i === index ? { ...v, image: undefined } : v)
                                      }));
                                    }}
                                  >
                                    <X className="h-3 w-3 text-white" />
                                  </button>
                                </div>
                              ) : (
                                <label className="cursor-pointer">
                                  <div className="h-8 w-8 rounded border border-dashed flex items-center justify-center hover:bg-muted transition-colors">
                                    <Upload className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => handleVariantImageUpload(index, e)}
                                  />
                                </label>
                              )}
                              <Switch
                                checked={variant.isActive !== false}
                                onCheckedChange={(checked) => {
                                  setNewProduct(prev => ({
                                    ...prev,
                                    variants: prev.variants.map((v, i) => i === index ? { ...v, isActive: checked } : v)
                                  }));
                                }}
                                className="scale-75"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">Price</Label>
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
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Cost</Label>
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
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Stock</Label>
                              <Input
                                type="number"
                                className="h-8"
                                value={variant.stock}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  setNewProduct(prev => ({
                                    ...prev,
                                    variants: prev.variants.map((v, i) => i === index ? { ...v, stock: val } : v)
                                  }));
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop Table Layout */}
                    <div className="hidden md:block border rounded-md overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-2 text-left">Variant</th>
                            <th className="p-2 w-24">Price</th>
                            <th className="p-2 w-24">Cost</th>
                            <th className="p-2 w-24">Stock</th>
                            <th className="p-2 w-20">Image</th>
                            <th className="p-2 w-10"></th>
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
                                  value={variant.stock}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    setNewProduct(prev => ({
                                      ...prev,
                                      variants: prev.variants.map((v, i) => i === index ? { ...v, stock: val } : v)
                                    }));
                                  }}
                                />
                              </td>
                              <td className="p-2">
                                <div className="flex items-center gap-2">
                                  {variant.image ? (
                                    <div className="relative h-8 w-8 rounded border overflow-hidden group">
                                      <img
                                        src={variant.image.startsWith('http') ? variant.image : `${BASE_URL}${variant.image}`}
                                        className="h-full w-full object-cover"
                                        alt=""
                                      />
                                      <button
                                        type="button"
                                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => {
                                          setNewProduct(prev => ({
                                            ...prev,
                                            variants: prev.variants.map((v, i) => i === index ? { ...v, image: undefined } : v)
                                          }));
                                        }}
                                      >
                                        <X className="h-3 w-3 text-white" />
                                      </button>
                                    </div>
                                  ) : (
                                    <label className="cursor-pointer">
                                      <div className="h-8 w-8 rounded border border-dashed flex items-center justify-center hover:bg-muted transition-colors">
                                        <Upload className="h-3 w-3 text-muted-foreground" />
                                      </div>
                                      <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={(e) => handleVariantImageUpload(index, e)}
                                      />
                                    </label>
                                  )}
                                </div>
                              </td>
                              <td className="p-2 text-right">
                                <Switch
                                  checked={variant.isActive !== false}
                                  onCheckedChange={(checked) => {
                                    setNewProduct(prev => ({
                                      ...prev,
                                      variants: prev.variants.map((v, i) => i === index ? { ...v, isActive: checked } : v)
                                    }));
                                  }}
                                  className="scale-75"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Product Images (Drag to reorder)</Label>
                    <label htmlFor="image-upload">
                      <Button type="button" variant="outline" size="sm" className="cursor-pointer" asChild>
                        <span>
                          <Upload className="h-3 w-3 mr-1" />
                          Upload Images
                        </span>
                      </Button>
                    </label>
                    <Input
                      id="image-upload"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                    />
                  </div>

                  <div
                    className={cn(
                      "border-2 border-dashed rounded-lg p-4 transition-colors",
                      isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20",
                      newProduct.images.length === 0 && "py-12"
                    )}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleImageUpload}
                  >
                    {newProduct.images.length === 0 ? (
                      <div className="text-center text-muted-foreground flex flex-col items-center gap-2">
                        <ImageIcon className="h-6 w-6 md:h-8 md:w-8 opacity-50" />
                        <p className="text-sm">Drag and drop images here</p>
                        <p className="text-xs opacity-70">JPG, PNG, GIF up to 10MB</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {newProduct.images.map((img, index) => (
                          <div
                            key={index}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", index.toString());
                              e.currentTarget.classList.add("opacity-50");
                            }}
                            onDragEnd={(e) => {
                              e.currentTarget.classList.remove("opacity-50");
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const dragIndex = parseInt(e.dataTransfer.getData("text/plain"));
                              if (dragIndex !== index) {
                                moveImage(dragIndex, index);
                              }
                            }}
                            className="relative group border rounded-lg overflow-hidden aspect-square bg-muted cursor-move"
                          >
                            <img
                              src={img.startsWith('http') ? img : `${BASE_URL}${img}`}
                              alt={`Product ${index + 1}`}
                              className="w-full h-full object-cover pointer-events-none"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeImage(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                            <div className="absolute bottom-1 left-1 bg-black/50 text-[10px] text-white px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              #{index + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="isFeatured" className="flex items-center gap-2">
                      <Settings className="h-4 w-4 text-yellow-500" />
                      Featured Product
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Highlight this product in the home page slider or featured section.
                    </p>
                  </div>
                  <Switch
                    id="isFeatured"
                    checked={newProduct.isFeatured}
                    onCheckedChange={(checked) => setNewProduct(prev => ({ ...prev, isFeatured: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="isActive" className="flex items-center gap-2">
                      <Settings className="h-4 w-4 text-primary" />
                      Product Status
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Enable or disable this product. Disabled products are hidden from the store.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-medium", newProduct.isActive ? "text-success" : "text-destructive")}>
                      {newProduct.isActive ? "Active" : "Disabled"}
                    </span>
                    <Switch
                      id="isActive"
                      checked={newProduct.isActive}
                      onCheckedChange={(checked) => setNewProduct(prev => ({ ...prev, isActive: checked }))}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter className="flex-shrink-0">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateProduct} disabled={!newProduct.name || isSubmitting}>
                  {isSubmitting ? (editingId ? 'Updating...' : 'Creating...') : (editingId ? 'Update Product' : 'Create Product')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={isCategoryDialogOpen} onOpenChange={(open) => {
        setIsCategoryDialogOpen(open);
        if (!open) handleCategoryParamsReset();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategoryId ? 'Edit Category' : 'Manage Categories'}</DialogTitle>
            <DialogDescription>Add, update or remove product categories.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex flex-col gap-3 border p-4 rounded-md bg-muted/20">
              <Label className="text-sm font-medium">
                {editingCategoryId ? 'Update Category' : 'New Category'}
              </Label>
              <div className="flex gap-2">
                <div className="relative h-10 w-10 flex-shrink-0 rounded overflow-hidden border bg-background">
                  {newCategoryImage ? (
                    <img
                      src={newCategoryImage.startsWith('http') ? newCategoryImage : `${BASE_URL}${newCategoryImage}`}
                      alt="Category"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-4 w-4" />
                    </div>
                  )}

                  <label htmlFor="cat-image-upload" className="absolute inset-0 cursor-pointer opacity-0" title="Upload Image">
                    <span className="sr-only">Upload</span>
                  </label>
                  <Input
                    id="cat-image-upload"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleCategoryImageUpload}
                  />
                </div>
                <Input
                  placeholder="Category name..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={async () => {
                  if (newCategoryName.trim()) {
                    if (editingCategoryId) {
                      await updateCategory(editingCategoryId, newCategoryName.trim(), newCategoryImage);
                      toast({ title: "Updated", description: "Category updated successfully." });
                    } else {
                      await addCategory(newCategoryName.trim(), newCategoryImage);
                      toast({ title: "Added", description: "Category added successfully." });
                    }
                    handleCategoryParamsReset();
                  }
                }}>{editingCategoryId ? 'Save' : 'Add'}</Button>
                {editingCategoryId && (
                  <Button variant="ghost" size="icon" onClick={handleCategoryParamsReset}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-2 max-h-60 overflow-y-auto pr-1">
              {categories.map(cat => (
                <div key={cat.id} className="p-2 flex items-center justify-between bg-card border rounded-md group hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded overflow-hidden bg-muted flex-shrink-0">
                      {cat.image ? (
                        <img
                          src={cat.image.startsWith('http') ? cat.image : `${BASE_URL}${cat.image}`}
                          alt={cat.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Tag className="h-4 w-4 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    <span className="font-medium text-sm">{cat.name}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setNewCategoryName(cat.name);
                        setNewCategoryImage(cat.image || '');
                        setEditingCategoryId(cat.id);
                      }}
                    >
                      <Edit className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteCategory(cat.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        {selectedProductIds.size > 0 && (
          <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg border animate-in fade-in slide-in-from-top-2">
            <span className="text-sm font-medium px-2">{selectedProductIds.size} items selected</span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedProductIds(new Set())}>Clear</Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" className="text-destructive border-destructive" onClick={() => setIsBulkDeleteDialogOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Disable Selected
            </Button>
          </div>
        )}
        {filteredProducts.map((product) => (
          <Card key={product.id} className={cn(
            "overflow-hidden transition-all duration-200",
            selectedProductIds.has(product.id) && "ring-2 ring-primary bg-primary/5"
          )}
            draggable
            onDragStart={(e) => {
              if (!selectedProductIds.has(product.id)) {
                e.preventDefault();
              }
            }}
          >
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/5 transition-colors"
              onClick={() => toggleExpand(product.id)}
            >
              <div className="flex items-center gap-4">
                <div
                  className="p-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newSelected = new Set(selectedProductIds);
                    if (newSelected.has(product.id)) {
                      newSelected.delete(product.id);
                    } else {
                      newSelected.add(product.id);
                    }
                    setSelectedProductIds(newSelected);
                  }}
                >
                  <div className={cn(
                    "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                    selectedProductIds.has(product.id) ? "bg-primary border-primary text-white" : "border-muted-foreground/30 hover:border-primary"
                  )}>
                    {selectedProductIds.has(product.id) && <Plus className="w-3 h-3 rotate-45" />}
                  </div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 overflow-hidden">
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0].startsWith('http') ? product.images[0] : `${BASE_URL}${product.images[0]}`}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Package className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-sm md:text-base line-clamp-1">{product.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {product.category} • {(product.variants || []).filter(v => showDisabled || v.isActive !== false).length} variants
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden md:flex gap-2">
                  {product.availableOnline && (
                    <Badge variant="default" className="text-xs bg-primary/20 text-primary hover:bg-primary/30">
                      <Globe className="h-3 w-3 mr-1" />
                      E-commerce
                    </Badge>
                  )}
                  {product.isFeatured && (
                    <Badge variant="default" className="text-xs bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200">
                      <Star className="h-3 w-3 mr-1 fill-yellow-500 text-yellow-500" />
                      Featured
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    Total Qty: {(product.variants || []).reduce((sum, v) => sum + v.stock, 0)}
                  </Badge>
                  <Badge
                    variant={product.isActive !== false ? "secondary" : "destructive"}
                    className={cn(
                      "text-[10px] capitalize",
                      product.isActive === false ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-success/10 text-success border-success/20"
                    )}
                  >
                    {product.isActive !== false ? "Active" : "Disabled"}
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
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setProductToDelete(product);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Disable Product
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

            {expandedProducts.has(product.id) && (
              <div className="border-t bg-muted/30 overflow-x-auto">
                <table className="data-table min-w-[800px] lg:min-w-full">
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
                    {(product.variants || [])
                      .filter(v => showDisabled || v.isActive !== false)
                      .map((variant) => (
                        <tr key={variant.id}>
                          <td className="font-mono text-xs md:text-sm">{variant.sku}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <Barcode className="h-4 w-4 text-muted-foreground hidden sm:block" />
                              <span className="font-mono text-xs md:text-sm">{variant.barcode}</span>
                            </div>
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(variant.attributes).map(([key, value]) => (
                                <Badge key={key} variant="outline" className="text-[10px] py-0 h-4">
                                  {value}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="text-xs md:text-sm">${variant.price.toFixed(2)}</td>
                          <td className="text-xs md:text-sm">${variant.cost.toFixed(2)}</td>
                          <td className="text-xs md:text-sm">{variant.stock}</td>
                          <td>
                            <StockBadge status={getStockStatus(variant.stock, variant.lowStockThreshold)} />
                          </td>
                          <td>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <Settings className="h-3 w-3" />
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
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-warning mb-2">
              <AlertTriangle className="h-5 w-5" />
              <AlertDialogTitle>Disable Product?</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Are you sure you want to disable <span className="font-semibold">{productToDelete?.name}</span>? Disabled products will be hidden from the store and sale screens, but can be re-enabled later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProductToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduct} className="bg-warning text-warning-foreground hover:bg-warning/90">
              Disable Product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-warning mb-2">
              <AlertTriangle className="h-5 w-5" />
              <AlertDialogTitle>Disable Multiple Products</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Are you sure you want to disable <span className="font-semibold">{selectedProductIds.size}</span> selected products? This will hide them from the store, but they can be re-enabled later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-warning text-warning-foreground hover:bg-warning/90">
              Disable All Selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout >
  );
}
