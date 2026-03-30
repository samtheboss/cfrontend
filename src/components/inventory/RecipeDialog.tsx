import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Plus, Trash2, Layers, Save } from 'lucide-react';
import { Recipe, RecipeIngredient, ProductVariant } from '@/types/inventory';
import { useInventory } from '@/contexts/InventoryContext';
import { toast } from 'sonner';

interface RecipeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: Partial<Recipe> | null;
  onSave?: (recipe: Recipe) => void;
  // If provided, the dialog won't call the backend itself
  onSaveOnly?: (recipe: Partial<Recipe>) => void;
  // If targetVariantId is provided, we lock the "Target Product" selection
  targetVariantId?: string | number;
}

export function RecipeDialog({ 
  isOpen, 
  onOpenChange, 
  recipe: initialRecipe, 
  onSave,
  onSaveOnly,
  targetVariantId 
}: RecipeDialogProps) {
  const { products, addRecipe, updateRecipe } = useInventory();
  const [editingRecipe, setEditingRecipe] = useState<Partial<Recipe> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state with prop
  useEffect(() => {
    if (isOpen && initialRecipe) {
      setEditingRecipe({
        ...initialRecipe,
        variantId: targetVariantId || initialRecipe.variantId || '',
        ingredients: initialRecipe.ingredients || [],
        yield: initialRecipe.yield || 1,
        autoProduce: initialRecipe.autoProduce ?? false,
        manualProduce: initialRecipe.manualProduce ?? true
      });
    }
  }, [isOpen, initialRecipe, targetVariantId]);

  // Flatten variants for selection
  const allVariants = products.flatMap(p => 
    p.variants.map(v => ({
      ...v,
      productName: p.name,
      productType: p.type,
      fullName: `${p.name} - ${Object.values(v.attributes).join(' / ') || 'Default'}`
    }))
  );

  const rawMaterials = allVariants.filter(v => v.productType === 'RAW_MATERIAL');

  const handleSave = async () => {
    if (!editingRecipe?.name || (!onSaveOnly && !editingRecipe.variantId) || !editingRecipe.ingredients?.length) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      if (onSaveOnly) {
        onSaveOnly(editingRecipe);
        onOpenChange(false);
        return;
      }

      let savedRecipe: Recipe;
      if (editingRecipe.id) {
        savedRecipe = await updateRecipe(editingRecipe as Recipe);
      } else {
        savedRecipe = await addRecipe(editingRecipe);
      }

      toast.success(`Recipe ${editingRecipe.id ? 'updated' : 'created'} successfully`);
      if (onSave) onSave(savedRecipe);
      onOpenChange(false);
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const addIngredient = () => {
    const newIngredient: Partial<RecipeIngredient> = {
      componentVariantId: '',
      quantity: 0,
    };
    setEditingRecipe(prev => ({
      ...prev,
      ingredients: [...(prev?.ingredients || []), newIngredient as RecipeIngredient]
    }));
  };

  const updateIngredient = (index: number, field: keyof RecipeIngredient, value: string | number) => {
    setEditingRecipe(prev => {
      if (!prev?.ingredients) return prev;
      const newIngredients = [...prev.ingredients];
      newIngredients[index] = { ...newIngredients[index], [field]: value };
      return { ...prev, ingredients: newIngredients };
    });
  };

  const removeIngredient = (index: number) => {
    setEditingRecipe(prev => ({
      ...prev,
      ingredients: prev?.ingredients?.filter((_, i) => i !== index)
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{editingRecipe?.id ? 'Edit Recipe' : 'New Recipe'}</DialogTitle>
          <DialogDescription>Define ingredients and proportions for a product.</DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4 overflow-y-auto pr-2">
          <div className="grid gap-2">
            <Label htmlFor="recipe-name">Recipe Name</Label>
            <Input 
              id="recipe-name" 
              value={editingRecipe?.name || ''} 
              onChange={e => setEditingRecipe(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Chocolate Fudge Cake"
            />
          </div>

          <div className="grid gap-2">
            <Label>Target Product (Finished Good)</Label>
            {targetVariantId || !onSaveOnly ? (
              <Select 
                value={editingRecipe?.variantId?.toString() || ''} 
                onValueChange={val => setEditingRecipe(prev => ({ ...prev, variantId: val }))}
                disabled={!!targetVariantId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select the item being produced" />
                </SelectTrigger>
                <SelectContent>
                  {allVariants.map(v => (
                    <SelectItem key={v.id} value={v.id.toString()}>{v.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-2 border rounded-md bg-muted text-sm text-muted-foreground">
                Will be linked automatically when product is saved.
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="recipe-yield">Recipe Yield (Base Quantity Produced)</Label>
            <Input 
              id="recipe-yield" 
              type="number" 
              min="0.001" 
              step="0.001"
              value={editingRecipe?.yield || 1} 
              onChange={e => setEditingRecipe(prev => ({ ...prev, yield: parseFloat(e.target.value) || 1 }))}
              placeholder="e.g., 30 (chapatis)"
            />
          </div>

          <div className="grid grid-cols-2 gap-6 p-4 border rounded-lg bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Automatic Production</Label>
                <p className="text-xs text-muted-foreground">Trigger production on every sale</p>
              </div>
              <Switch 
                checked={editingRecipe?.autoProduce || false} 
                onCheckedChange={checked => setEditingRecipe(prev => ({ ...prev, autoProduce: checked }))} 
              />
            </div>
            <div className="flex items-center justify-between border-l pl-6">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Manual Production</Label>
                <p className="text-xs text-muted-foreground">Enable the "Produce" button</p>
              </div>
              <Switch 
                checked={editingRecipe?.manualProduce || false} 
                onCheckedChange={checked => setEditingRecipe(prev => ({ ...prev, manualProduce: checked }))} 
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base">Ingredients (Raw Materials)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
                <Plus className="h-3 w-3 mr-2" />
                Add Ingredient
              </Button>
            </div>
            
            <div className="space-y-3">
              {editingRecipe?.ingredients?.map((ing, idx) => (
                <div key={idx} className="flex gap-3 items-end border p-3 rounded-lg bg-muted/20">
                  <div className="flex-1 space-y-2">
                    <Label className="text-xs">Component Item</Label>
                    <Select 
                      value={ing.componentVariantId?.toString()} 
                      onValueChange={val => updateIngredient(idx, 'componentVariantId', val)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select material" />
                      </SelectTrigger>
                      <SelectContent>
                        {rawMaterials.filter(v => 
                          (!editingRecipe?.ingredients?.some((otherIng, otherIdx) => 
                            otherIdx !== idx && otherIng.componentVariantId?.toString() === v.id?.toString()
                          ))
                        ).map(v => (
                          <SelectItem key={v.id} value={v.id.toString()}>{v.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24 space-y-2">
                    <Label className="text-xs">Quantity</Label>
                    <Input 
                      type="number" 
                      step="0.001"
                      className="h-9"
                      value={ing.quantity} 
                      onChange={e => updateIngredient(idx, 'quantity', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeIngredient(idx)}
                    className="text-destructive h-9 w-9"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {!editingRecipe?.ingredients?.length && (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <Layers className="h-8 w-8 mx-auto text-muted-foreground opacity-20 mb-2" />
                  <p className="text-sm text-muted-foreground">No ingredients added yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Recipe'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
