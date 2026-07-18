import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Slide } from '@/types/inventory';
import { Plus, Search, Edit, Trash2, Image as ImageIcon, Upload, X, ArrowRight, MoveUp, MoveDown } from 'lucide-react';
import { apiFetch, getBaseUrl } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function Slides() {
    const { toast } = useToast();
    const [slides, setSlides] = useState<Slide[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const [newSlide, setNewSlide] = useState<Partial<Slide>>({
        title: '',
        subtitle: '',
        image: '',
        link: '/products',
        cta: 'Shop Now',
        displayOrder: 0,
        isActive: true,
    });

    const fetchSlides = async () => {
        setIsLoading(true);
        try {
            const response = await apiFetch<{ data: Slide[] }>('/api/slides');
            setSlides(response.data);
        } catch (error) {
            console.error('Failed to fetch slides:', error);
            toast({
                title: "Error",
                description: "Failed to load slides",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSlides();
    }, []);

    const handleSave = async () => {
        try {
            await apiFetch('/api/slides', {
                method: 'POST',
                body: JSON.stringify(newSlide),
            });
            toast({
                title: "Success",
                description: editingId ? "Slide updated successfully" : "Slide created successfully",
            });
            setIsDialogOpen(false);
            resetForm();
            fetchSlides();
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to save slide",
                variant: "destructive"
            });
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this slide?')) return;
        try {
            await apiFetch(`/api/slides/${id}`, {
                method: 'DELETE',
            });
            toast({
                title: "Deleted",
                description: "Slide removed successfully",
            });
            fetchSlides();
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete slide",
                variant: "destructive"
            });
        }
    };

    const handleEdit = (slide: Slide) => {
        setEditingId(slide.id || null);
        setNewSlide(slide);
        setIsDialogOpen(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setNewSlide({
            title: '',
            subtitle: '',
            image: '',
            link: '/products',
            cta: 'Shop Now',
            displayOrder: slides.length,
            isActive: true,
        });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await apiFetch<{ url: string }>('/api/upload', {
                method: 'POST',
                body: formData,
            });
            setNewSlide(prev => ({ ...prev, image: response.url }));
        } catch (error) {
            toast({
                title: "Upload Failed",
                description: "Could not upload image.",
                variant: "destructive"
            });
        }
    };

    return (
        <AppLayout title="Home Page Slides">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">E-commerce Banners</h2>
                    <p className="text-muted-foreground">Manage the content and order of your home page slider.</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button onClick={resetForm}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Slide
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>{editingId ? 'Edit Slide' : 'Add New Slide'}</DialogTitle>
                            <DialogDescription>
                                Create an attractive banner for your home page.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="title">Headline</Label>
                                <Input
                                    id="title"
                                    value={newSlide.title}
                                    onChange={(e) => setNewSlide(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="e.g., Summer Collection 2024"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="subtitle">Sub-headline</Label>
                                <Input
                                    id="subtitle"
                                    value={newSlide.subtitle}
                                    onChange={(e) => setNewSlide(prev => ({ ...prev, subtitle: e.target.value }))}
                                    placeholder="e.g., Up to 50% off on all items"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Banner Image</Label>
                                <div className="flex gap-4 items-start">
                                    <div className={cn(
                                        "h-24 w-40 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted",
                                        newSlide.image ? "border-solid" : "border-muted-foreground/20"
                                    )}>
                                        {newSlide.image ? (
                                            <img
                                                src={newSlide.image.startsWith('http') ? newSlide.image : `${getBaseUrl()}${newSlide.image}`}
                                                className="h-full w-full object-cover"
                                                alt="Slide preview"
                                            />
                                        ) : (
                                            <ImageIcon className="h-8 w-8 text-muted-foreground opacity-30" />
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <Button variant="outline" size="sm" className="w-full relative cursor-pointer" asChild>
                                            <label>
                                                <Upload className="h-3 w-3 mr-2" />
                                                Upload
                                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                            </label>
                                        </Button>
                                        <Input
                                            placeholder="Or enter URL..."
                                            value={newSlide.image}
                                            onChange={(e) => setNewSlide(prev => ({ ...prev, image: e.target.value }))}
                                            className="h-8 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="cta">Button Text</Label>
                                    <Input
                                        id="cta"
                                        value={newSlide.cta}
                                        onChange={(e) => setNewSlide(prev => ({ ...prev, cta: e.target.value }))}
                                        placeholder="e.g., Shop Now"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="link">Button Link</Label>
                                    <Input
                                        id="link"
                                        value={newSlide.link}
                                        onChange={(e) => setNewSlide(prev => ({ ...prev, link: e.target.value }))}
                                        placeholder="e.g., /products"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="order">Display Order</Label>
                                    <Input
                                        id="order"
                                        type="number"
                                        value={newSlide.displayOrder}
                                        onChange={(e) => setNewSlide(prev => ({ ...prev, displayOrder: parseInt(e.target.value) || 0 }))}
                                    />
                                </div>
                                <div className="flex items-center gap-2 mt-auto pb-2">
                                    <Switch
                                        id="active"
                                        checked={newSlide.isActive}
                                        onCheckedChange={(checked) => setNewSlide(prev => ({ ...prev, isActive: checked }))}
                                    />
                                    <Label htmlFor="active">Published</Label>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleSave}>Save Slide</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-6">
                {isLoading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-2"></div>
                        <p className="text-muted-foreground font-medium">Loading slides...</p>
                    </div>
                ) : slides.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="py-12 text-center text-muted-foreground">
                            <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>No slides found. Add your first banner to get started.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {slides.map((slide) => (
                            <Card key={slide.id} className={cn(
                                "overflow-hidden group",
                                !slide.isActive && "opacity-60"
                            )}>
                                <div className="aspect-video relative overflow-hidden bg-muted">
                                    <img
                                        src={slide.image.startsWith('http') ? slide.image : `${getBaseUrl()}${slide.image}`}
                                        alt={slide.title}
                                        className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-6">
                                        <div className="text-white">
                                            <h3 className="text-xl font-bold">{slide.title}</h3>
                                            <p className="text-sm opacity-90 line-clamp-1">{slide.subtitle}</p>
                                        </div>
                                    </div>
                                    <div className="absolute top-4 left-4 flex gap-2">
                                        <Badge variant={slide.isActive ? "default" : "secondary"} className="shadow-lg">
                                            {slide.isActive ? "Active" : "Inactive"}
                                        </Badge>
                                        <Badge variant="outline" className="bg-white/80 backdrop-blur shadow-lg border-none text-black font-bold">
                                            Order: {slide.displayOrder}
                                        </Badge>
                                    </div>
                                    <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-y-[-10px] group-hover:translate-y-0 duration-300">
                                        <Button size="icon" variant="secondary" className="h-8 w-8 shadow-xl" onClick={() => handleEdit(slide)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="destructive" className="h-8 w-8 shadow-xl" onClick={() => handleDelete(slide.id!)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <CardContent className="p-4 bg-card/50 flex justify-between items-center border-t">
                                    <div className="flex gap-2 items-center text-sm font-medium">
                                        <span className="bg-primary/10 text-primary px-3 py-1 rounded-full uppercase tracking-wider text-[10px]">
                                            {slide.cta}
                                        </span>
                                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-muted-foreground font-mono text-[11px] truncate max-w-[150px]">
                                            {slide.link}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
