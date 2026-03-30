import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { Recipe, RecipeIngredient, ProductVariant } from '@/types/inventory';
import { Plus, Search, ChefHat, Trash2, Edit, Save, X, Package, Layers } from 'lucide-react';
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
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { RecipeDialog } from '@/components/inventory/RecipeDialog';

export default function Recipes() {
  const { products, recipes, locations, addRecipe, updateRecipe, deleteRecipe, refreshData } = useInventory();
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Partial<Recipe> | null>(null);
  
  // Production state
  const [isProduceDialogOpen, setIsProduceDialogOpen] = useState(false);
  const [produceRecipe, setProduceRecipe] = useState<Recipe | null>(null);
  const [produceQuantity, setProduceQuantity] = useState(1);
  const [produceLocation, setProduceLocation] = useState(locations[0]?.id || '');

  useEffect(() => {
    if (locations.length > 0 && !produceLocation) {
      setProduceLocation(locations[0].id);
    }
  }, [locations]);

  // Flatten variants for selection
  const allVariants = products.flatMap(p => 
    p.variants.map(v => ({
      ...v,
      productName: p.name,
      productType: p.type,
      fullName: `${p.name} - ${Object.values(v.attributes).join(' / ') || 'Default'}`
    }))
  );

  const handleProduce = async () => {
    if (!produceRecipe || !produceLocation || produceQuantity <= 0) {
      toast.error('Please fill in all production details');
      return;
    }

    setIsLoading(true);
    try {
      await apiFetch(`/api/production/produce?variantId=${produceRecipe.variantId}&quantity=${produceQuantity}&locationId=${produceLocation}`, {
        method: 'POST'
      });
      toast.success(`Produced ${produceQuantity} ${produceRecipe.name} successfully`);
      setIsProduceDialogOpen(false);
      refreshData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete production');
    } finally {
      setIsLoading(false);
    }
  };

  const removeIngredient = (index: number) => {
    setEditingRecipe(prev => ({
      ...prev,
      ingredients: prev?.ingredients?.filter((_, i) => i !== index)
    }));
  };

  const filteredRecipes = recipes.filter(r => 
    (r.name || 'Unnamed Recipe').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout title="Production & Recipes">
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search recipes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => {
          setEditingRecipe({ name: '', ingredients: [], variantId: '', autoProduce: false, manualProduce: true, yield: 1 });
          setIsDialogOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          New Recipe
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRecipes.map(recipe => (
          <Card key={recipe.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <CardHeader className="bg-primary/5 pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{recipe.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Target: {allVariants.find(v => v.id?.toString() === recipe.variantId?.toString())?.fullName || 'Unknown'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ChefHat className="h-6 w-6 text-primary opacity-50" />
                  {recipe.autoProduce && (
                    <div className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter">
                      Auto
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ingredients</p>
                {recipe.ingredients.slice(0, 3).map((ing, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{allVariants.find(v => v.id?.toString() === ing.componentVariantId?.toString())?.fullName || 'Item'}</span>
                    <span className="font-medium">{ing.quantity.toFixed(3)}</span>
                  </div>
                ))}
                {recipe.ingredients.length > 3 && (
                  <p className="text-xs text-center text-muted-foreground italic">+{recipe.ingredients.length - 3} more ingredients</p>
                )}
              </div>
              <div className="mt-6 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                  setEditingRecipe(recipe);
                  setIsDialogOpen(true);
                }}>
                  <Edit className="h-3 w-3 mr-2" />
                  Edit
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  className="flex-1" 
                  disabled={!recipe.manualProduce}
                  onClick={() => {
                    setProduceRecipe(recipe);
                    setProduceQuantity(1);
                    setIsProduceDialogOpen(true);
                  }}
                >
                  <Package className="h-3 w-3 mr-2" />
                  Produce
                </Button>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isProduceDialogOpen} onOpenChange={setIsProduceDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Produce Items</DialogTitle>
            <DialogDescription>
              Increase stock of the finished good and reduce raw materials.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Product to Produce</Label>
              <Input value={produceRecipe?.name || ''} disabled className="bg-muted" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="produce-qty">Quantity</Label>
                <Input 
                  id="produce-qty" 
                  type="number" 
                  min="0.001" 
                  step="0.001"
                  value={produceQuantity} 
                  onChange={e => setProduceQuantity(parseFloat(e.target.value) || 0)} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="produce-location">Location</Label>
                <Select value={produceLocation} onValueChange={setProduceLocation}>
                  <SelectTrigger id="produce-location">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {produceRecipe && (
              <div className="mt-2 p-3 border rounded-md bg-muted/20">
                <p className="text-xs font-semibold mb-2 uppercase text-muted-foreground">Required Ingredients:</p>
                {produceRecipe.ingredients.map((ing, idx) => {
                  const variant = allVariants.find(v => v.id?.toString() === ing.componentVariantId?.toString());
                  return (
                    <div key={idx} className="flex justify-between text-xs py-1 border-b last:border-0">
                      <span>{variant?.fullName || 'Material'}</span>
                      <span className="font-mono">{(ing.quantity * (produceQuantity / (produceRecipe.yield || 1))).toFixed(3)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProduceDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleProduce} disabled={isLoading}>
              {isLoading ? 'Processing...' : 'Confirm Production'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <RecipeDialog 
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        recipe={editingRecipe}
      />
    </AppLayout>
  );
}
