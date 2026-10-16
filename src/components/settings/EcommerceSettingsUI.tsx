import { useState, useEffect, useRef } from 'react';
import { apiFetch, getBaseUrl } from '@/lib/api';
import { EcommerceSettings, HeroSlideConfig } from '@/types/inventory';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
    Globe,
    Image as ImageIcon,
    Phone,
    Mail,
    Loader2,
    Palette,
    Sun,
    Moon,
    Laptop,
    Check,
    ExternalLink,
    Sparkles,
    Eye,
    ShoppingBag,
    Heart,
    Search,
    RotateCcw,
    Store,
    CheckCircle2,
    Monitor,
    Smartphone,
    Upload,
    Plus,
    Trash2,
    ArrowUp,
    ArrowDown,
    Copy,
    ChevronLeft,
    ChevronRight,
    Layers,
    FileImage,
    X,
    FolderPlus
} from 'lucide-react';
import { toast } from 'sonner';

export const ECOMMERCE_THEME_COLORS = [
    {
        id: 'vibrant-pink',
        name: 'Rose Romance',
        hex: '#ec4899',
        gradient: 'from-pink-500 to-rose-400',
        desc: 'Vibrant pink & rose tones, ideal for confectionery and luxury fashion',
    },
    {
        id: 'coral-sunset',
        name: 'Coral Sunset',
        hex: '#f43f5e',
        gradient: 'from-rose-500 to-orange-400',
        desc: 'Warm coral, fiery rose, and golden undertones',
    },
    {
        id: 'warm-amber',
        name: 'Warm Amber',
        hex: '#d97706',
        gradient: 'from-amber-600 to-yellow-500',
        desc: 'Warm caramel, golden amber, and bakery warmth',
    },
    {
        id: 'ocean-blue',
        name: 'Ocean Blue',
        hex: '#0284c7',
        gradient: 'from-sky-500 to-blue-600',
        desc: 'Crisp azure, cyan, and refreshing nautical blue',
    },
    {
        id: 'emerald-green',
        name: 'Emerald Luxe',
        hex: '#059669',
        gradient: 'from-emerald-500 to-teal-600',
        desc: 'Rich botanic emerald, organic and fresh luxury',
    },
    {
        id: 'royal-purple',
        name: 'Royal Violet',
        hex: '#7c3aed',
        gradient: 'from-violet-600 to-fuchsia-500',
        desc: 'Regal violet, lavender, and majestic orchid',
    },
    {
        id: 'luxury-onyx',
        name: 'Luxury Onyx',
        hex: '#0f172a',
        gradient: 'from-slate-900 to-slate-700',
        desc: 'Minimalist slate, dark aesthetic, and monochrome modernism',
    },
    {
        id: 'wine-berry',
        name: 'Wine Berry',
        hex: '#9d174d',
        gradient: 'from-pink-700 to-rose-900',
        desc: 'Deep burgundy, velvet wine, and rich plum accents',
    },
];

const PRESET_BANNERS = [
    {
        name: 'Artisan Bakery',
        url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=1400',
    },
    {
        name: 'Sweet Delights',
        url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=1400&auto=format&fit=crop',
    },
    {
        name: 'Celebration Cakes',
        url: 'https://images.unsplash.com/photo-1535141192574-5d4897c13136?q=80&w=1400&auto=format&fit=crop',
    },
    {
        name: 'Silk & Satin',
        url: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&q=80&w=1400',
    },
    {
        name: 'Fashion Boutique',
        url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=1400',
    },
    {
        name: 'Modern Luxury',
        url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=80&w=1400',
    },
];

export const resolveImageUrl = (url?: string | null): string => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
        return url;
    }
    const base = getBaseUrl();
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

const parseSlides = (jsonStr?: string, defaultBanner?: string, defaultTitle?: string, defaultSubtitle?: string): HeroSlideConfig[] => {
    if (jsonStr) {
        try {
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed.map((item: any, idx: number) => ({
                    id: item.id || `slide-${Date.now()}-${idx}`,
                    image: item.image || defaultBanner || PRESET_BANNERS[0].url,
                    title: item.title || defaultTitle || "Sweet Moments, Baked Daily",
                    subtitle: item.subtitle || defaultSubtitle || "Discover our curated collection of artisanal treats.",
                    ctaText: item.ctaText || item.cta || "Shop Now",
                    ctaLink: item.ctaLink || item.link || "/products",
                    showLogo: item.showLogo !== undefined ? !!item.showLogo : true,
                }));
            }
        } catch (e) {
            console.error('Failed to parse heroSlidesJson', e);
        }
    }
    return [
        {
            id: 'slide-1',
            image: defaultBanner || PRESET_BANNERS[0].url,
            title: defaultTitle || "Sweet Moments, Baked Daily",
            subtitle: defaultSubtitle || "Indulge in our collection of artisanal cakes, pastries, and treats crafted with love.",
            ctaText: "Order Now",
            ctaLink: "/products",
            showLogo: true,
        },
        {
            id: 'slide-2',
            image: PRESET_BANNERS[1].url,
            title: "Custom Cakes For Every Occasion",
            subtitle: "Bespoke creations designed to make your celebrations unforgettable.",
            ctaText: "Explore Collection",
            ctaLink: "/products",
            showLogo: false,
        }
    ];
};

export default function EcommerceSettingsUI() {
    const [settings, setSettings] = useState<EcommerceSettings | null>(null);
    const [initialSettings, setInitialSettings] = useState<EcommerceSettings | null>(null);
    const [heroSlides, setHeroSlides] = useState<HeroSlideConfig[]>([]);
    const [activeSlideIndex, setActiveSlideIndex] = useState(0);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [uploadingSlideId, setUploadingSlideId] = useState<string | null>(null);
    const [isUploadingBatch, setIsUploadingBatch] = useState(false);

    const [activeTab, setActiveTab] = useState('hero');
    const [previewThemeOverride, setPreviewThemeOverride] = useState<'light' | 'dark' | null>(null);
    const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
    const [previewSlideIndex, setPreviewSlideIndex] = useState(0);
    const [isPreviewHovered, setIsPreviewHovered] = useState(false);

    // File input refs
    const logoFileInputRef = useRef<HTMLInputElement>(null);
    const singleSlideFileInputRef = useRef<HTMLInputElement>(null);
    const batchSlideFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    // Auto-advance preview slides
    useEffect(() => {
        if (heroSlides.length <= 1 || isPreviewHovered) return;
        const timer = setInterval(() => {
            setPreviewSlideIndex((prev) => (prev + 1) % heroSlides.length);
        }, 4000);
        return () => clearInterval(timer);
    }, [heroSlides.length, isPreviewHovered]);

    const fetchSettings = async () => {
        try {
            const data = await apiFetch<EcommerceSettings>('/api/ecommerce-settings');
            const parsed = parseSlides(data.heroSlidesJson, data.heroBannerUrl, data.heroTitle, data.heroSubtitle);
            const first = parsed[0];

            const sanitized: EcommerceSettings = {
                ...data,
                shopName: data.shopName || "Smart Shop",
                shopDescription: data.shopDescription || 'Curated collections & quality goods',
                heroTitle: (first ? first.title : data.heroTitle) || 'Sweet Moments, Baked Daily',
                heroSubtitle: (first ? first.subtitle : data.heroSubtitle) || 'Discover our new season collection crafted with care.',
                heroBannerUrl: (first ? first.image : data.heroBannerUrl) || PRESET_BANNERS[0].url,
                heroSlidesJson: JSON.stringify(parsed),
                themeMode: data.themeMode || 'light',
                primaryColor: data.primaryColor || 'vibrant-pink',
                contactEmail: data.contactEmail || '',
                contactPhone: data.contactPhone || '',
                footerText: data.footerText || `© ${new Date().getFullYear()} ${data.shopName || 'Store'}. All rights reserved.`,
            };

            setHeroSlides(parsed);
            setSettings(sanitized);
            setInitialSettings(sanitized);
        } catch (error) {
            toast.error('Failed to load eCommerce settings');
        } finally {
            setIsLoading(false);
        }
    };

    const updateHeroSlides = (newSlides: HeroSlideConfig[]) => {
        setHeroSlides(newSlides);
        if (settings) {
            const first = newSlides[0];
            const updated: EcommerceSettings = {
                ...settings,
                heroSlidesJson: JSON.stringify(newSlides),
                heroBannerUrl: first ? first.image : settings.heroBannerUrl,
                heroTitle: first ? first.title : settings.heroTitle,
                heroSubtitle: first ? first.subtitle : settings.heroSubtitle,
            };
            setSettings(updated);
        }
    };

    const handleSave = async () => {
        if (!settings) return;
        setIsSaving(true);
        try {
            const payload: EcommerceSettings = {
                ...settings,
                heroSlidesJson: JSON.stringify(heroSlides),
                heroBannerUrl: heroSlides[0]?.image || settings.heroBannerUrl,
                heroTitle: heroSlides[0]?.title || settings.heroTitle,
                heroSubtitle: heroSlides[0]?.subtitle || settings.heroSubtitle,
            };

            await apiFetch('/api/ecommerce-settings', {
                method: 'PUT',
                body: JSON.stringify(payload),
            });
            setSettings(payload);
            setInitialSettings(payload);
            toast.success('eCommerce storefront settings published successfully!');
        } catch (error) {
            toast.error('Failed to update eCommerce settings');
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        if (initialSettings) {
            setSettings({ ...initialSettings });
            const parsed = parseSlides(initialSettings.heroSlidesJson, initialSettings.heroBannerUrl, initialSettings.heroTitle, initialSettings.heroSubtitle);
            setHeroSlides(parsed);
            setActiveSlideIndex(0);
            toast.info('Restored saved eCommerce settings');
        }
    };

    // Logo Upload Handler
    const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !settings) return;
        e.target.value = '';

        setIsUploadingLogo(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await apiFetch<{ url: string }>('/api/upload', {
                method: 'POST',
                body: formData,
            });
            setSettings({ ...settings, logoUrl: res.url });
            toast.success('Store logo uploaded successfully!');
        } catch (error) {
            console.error('Logo upload failed:', error);
            toast.error('Failed to upload logo image');
        } finally {
            setIsUploadingLogo(false);
        }
    };

    // Single Slide Image Upload Handler
    const handleSlideFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !heroSlides[activeSlideIndex]) return;
        const targetSlide = heroSlides[activeSlideIndex];
        e.target.value = '';

        setUploadingSlideId(targetSlide.id);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await apiFetch<{ url: string }>('/api/upload', {
                method: 'POST',
                body: formData,
            });
            const updated = heroSlides.map((s, idx) => idx === activeSlideIndex ? { ...s, image: res.url } : s);
            updateHeroSlides(updated);
            toast.success(`Slide #${activeSlideIndex + 1} image uploaded!`);
        } catch (error) {
            console.error('Slide upload failed:', error);
            toast.error('Failed to upload slide image');
        } finally {
            setUploadingSlideId(null);
        }
    };

    // Batch Multi-Image Slide Upload Handler
    const handleBatchFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        e.target.value = '';

        setIsUploadingBatch(true);
        const newAddedSlides: HeroSlideConfig[] = [];
        let successCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const formData = new FormData();
            formData.append('file', file);
            try {
                const res = await apiFetch<{ url: string }>('/api/upload', {
                    method: 'POST',
                    body: formData,
                });
                const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
                const title = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
                newAddedSlides.push({
                    id: `slide-${Date.now()}-${i}`,
                    image: res.url,
                    title: title || `Showcase Slide ${heroSlides.length + i + 1}`,
                    subtitle: "Handcrafted selections baked fresh daily with love.",
                    ctaText: "Order Now",
                    ctaLink: "/products",
                    showLogo: true,
                });
                successCount++;
            } catch (err) {
                console.error(`Failed to upload ${file.name}:`, err);
            }
        }

        if (newAddedSlides.length > 0) {
            const updated = [...heroSlides, ...newAddedSlides];
            updateHeroSlides(updated);
            setActiveSlideIndex(updated.length - 1);
            setPreviewSlideIndex(updated.length - 1);
            toast.success(`Uploaded ${successCount} new sliding image(s) successfully!`);
        } else {
            toast.error('Could not upload selected images');
        }
        setIsUploadingBatch(false);
    };

    // Slide Management
    const handleAddSlide = () => {
        const newSlide: HeroSlideConfig = {
            id: `slide-${Date.now()}`,
            image: PRESET_BANNERS[(heroSlides.length) % PRESET_BANNERS.length].url,
            title: `Featured Showcase #${heroSlides.length + 1}`,
            subtitle: "Discover our seasonal treats and custom artisanal delights.",
            ctaText: "Shop Collection",
            ctaLink: "/products",
            showLogo: true,
        };
        const updated = [...heroSlides, newSlide];
        updateHeroSlides(updated);
        setActiveSlideIndex(updated.length - 1);
        setPreviewSlideIndex(updated.length - 1);
        toast.success('Added new hero slide');
    };

    const handleDeleteSlide = (idxToDelete: number) => {
        if (heroSlides.length <= 1) {
            toast.warning('You must keep at least one hero slide.');
            return;
        }
        const updated = heroSlides.filter((_, idx) => idx !== idxToDelete);
        updateHeroSlides(updated);
        const nextIdx = Math.min(activeSlideIndex, updated.length - 1);
        setActiveSlideIndex(nextIdx);
        setPreviewSlideIndex(nextIdx);
        toast.info('Slide removed');
    };

    const handleDuplicateSlide = (idx: number) => {
        const target = heroSlides[idx];
        if (!target) return;
        const dup: HeroSlideConfig = {
            ...target,
            id: `slide-${Date.now()}`,
            title: `${target.title} (Copy)`,
        };
        const updated = [...heroSlides];
        updated.splice(idx + 1, 0, dup);
        updateHeroSlides(updated);
        setActiveSlideIndex(idx + 1);
        setPreviewSlideIndex(idx + 1);
        toast.success('Slide duplicated');
    };

    const handleMoveSlide = (fromIdx: number, toIdx: number) => {
        if (toIdx < 0 || toIdx >= heroSlides.length) return;
        const updated = [...heroSlides];
        const [item] = updated.splice(fromIdx, 1);
        updated.splice(toIdx, 0, item);
        updateHeroSlides(updated);
        setActiveSlideIndex(toIdx);
        setPreviewSlideIndex(toIdx);
    };

    const handleUpdateActiveSlide = (fields: Partial<HeroSlideConfig>) => {
        const updated = heroSlides.map((s, idx) => idx === activeSlideIndex ? { ...s, ...fields } : s);
        updateHeroSlides(updated);
    };

    const hasUnsavedChanges = JSON.stringify(settings) !== JSON.stringify(initialSettings);

    if (isLoading || !settings) {
        return (
            <div className="flex h-72 items-center justify-center">
                <div className="text-center space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                    <p className="text-xs text-muted-foreground">Loading storefront studio...</p>
                </div>
            </div>
        );
    }

    const currentPalette = ECOMMERCE_THEME_COLORS.find(c => c.id === settings.primaryColor) || ECOMMERCE_THEME_COLORS[0];
    const previewMode = previewThemeOverride ?? (settings.themeMode === 'dark' ? 'dark' : 'light');
    const activeSlide = heroSlides[activeSlideIndex] || heroSlides[0];
    const currentPreview = heroSlides[previewSlideIndex] || heroSlides[0] || activeSlide;

    return (
        <div className="space-y-6 pb-12">
            {/* Hidden File Inputs */}
            <input
                ref={logoFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoFileChange}
            />
            <input
                ref={singleSlideFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleSlideFileChange}
            />
            <input
                ref={batchSlideFileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleBatchFilesChange}
            />

            {/* Top Studio Header */}
            <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-primary/5 p-5 md:p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                                <Store className="h-5 w-5" />
                            </div>
                            <h2 className="text-lg md:text-xl font-bold tracking-tight text-foreground">
                                eCommerce Storefront Studio
                            </h2>
                            <Badge variant="outline" className="gap-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[11px] font-semibold py-0.5">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                Storefront Active
                            </Badge>
                        </div>
                        <p className="text-xs md:text-sm text-muted-foreground max-w-2xl">
                            Upload your brand logo, configure interactive hero sliding images with custom headlines and links, and customize theme colors with instant live preview.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs h-9 rounded-xl hover:bg-secondary/60"
                            onClick={() => window.open(window.location.origin, '_blank')}
                        >
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="hidden sm:inline">Visit Store</span>
                        </Button>

                        {hasUnsavedChanges && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleReset}
                                className="gap-1 text-xs h-9 rounded-xl text-muted-foreground hover:text-foreground"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Discard
                            </Button>
                        )}

                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="gap-2 h-9 rounded-xl text-xs font-semibold shadow-md px-4"
                        >
                            {isSaving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                            Save Changes
                        </Button>
                    </div>
                </div>
            </div>

            {/* Studio Workspace Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Configuration Panels (Left, 7 Cols) */}
                <div className="xl:col-span-7 space-y-4">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid grid-cols-4 h-11 p-1 bg-muted/50 rounded-xl border">
                            <TabsTrigger value="hero" className="text-xs font-medium rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                <ImageIcon className="h-3.5 w-3.5" />
                                <span>Hero Slider</span>
                            </TabsTrigger>
                            <TabsTrigger value="branding" className="text-xs font-medium rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                <Globe className="h-3.5 w-3.5" />
                                <span>Logo & Identity</span>
                            </TabsTrigger>
                            <TabsTrigger value="theme" className="text-xs font-medium rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                <Palette className="h-3.5 w-3.5" />
                                <span>Theme & Color</span>
                            </TabsTrigger>
                            <TabsTrigger value="contact" className="text-xs font-medium rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                <Phone className="h-3.5 w-3.5" />
                                <span>Contact & Footer</span>
                            </TabsTrigger>
                        </TabsList>

                        {/* TAB: HERO SHOWCASE & MULTIPLE SLIDING IMAGES */}
                        <TabsContent value="hero" className="mt-4 space-y-4">
                            <Card className="rounded-2xl shadow-sm border overflow-hidden">
                                <CardHeader className="p-5 pb-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                                <Layers className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <CardTitle className="text-sm font-semibold">Hero Sliding Images</CardTitle>
                                                    <Badge variant="secondary" className="text-[10px] h-5 px-2">
                                                        {heroSlides.length} {heroSlides.length === 1 ? 'Slide' : 'Slides'}
                                                    </Badge>
                                                </div>
                                                <CardDescription className="text-xs">
                                                    Upload your banner images and customize headline, subtitle, and buttons for each slide.
                                                </CardDescription>
                                            </div>
                                        </div>

                                        {/* Action buttons to add / batch upload */}
                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => batchSlideFileInputRef.current?.click()}
                                                disabled={isUploadingBatch}
                                                className="h-8 rounded-xl text-xs gap-1.5 border-dashed"
                                            >
                                                {isUploadingBatch ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <FolderPlus className="h-3.5 w-3.5 text-primary" />
                                                )}
                                                <span>Upload Images</span>
                                            </Button>

                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={handleAddSlide}
                                                className="h-8 rounded-xl text-xs gap-1.5 shadow-xs"
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                                <span>Add Slide</span>
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>

                                <CardContent className="p-5 pt-1 space-y-5">
                                    {/* Slide Thumbnails Selector Carousel */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground px-0.5">
                                            <span>Slide Sequence (Click to edit):</span>
                                            <span>Slide {activeSlideIndex + 1} of {heroSlides.length}</span>
                                        </div>

                                        <div className="flex gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar">
                                            {heroSlides.map((slide, idx) => {
                                                const isActive = idx === activeSlideIndex;
                                                return (
                                                    <div
                                                        key={slide.id || idx}
                                                        onClick={() => {
                                                            setActiveSlideIndex(idx);
                                                            setPreviewSlideIndex(idx);
                                                        }}
                                                        className={`group relative flex-shrink-0 w-28 h-20 rounded-xl overflow-hidden border cursor-pointer transition-all ${
                                                            isActive
                                                                ? 'ring-2 ring-primary border-primary shadow-md scale-102'
                                                                : 'hover:border-muted-foreground/40 opacity-75 hover:opacity-100'
                                                        }`}
                                                    >
                                                        <img
                                                            src={resolveImageUrl(slide.image)}
                                                            alt={slide.title}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).src = PRESET_BANNERS[0].url;
                                                            }}
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-1.5 flex flex-col justify-between">
                                                            <div className="flex justify-between items-center">
                                                                <span className="px-1.5 py-0.5 rounded-md bg-black/60 text-white font-bold text-[9px] backdrop-blur-xs">
                                                                    #{idx + 1}
                                                                </span>
                                                                {slide.showLogo && settings.logoUrl && (
                                                                    <span className="px-1 py-0.5 rounded-md bg-primary/80 text-white text-[8px] font-bold">
                                                                        Logo
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] font-medium text-white line-clamp-1 drop-shadow">
                                                                {slide.title || 'Untitled'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Active Slide Detailed Editor Card */}
                                    {activeSlide && (
                                        <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
                                            <div className="flex items-center justify-between pb-2 border-b">
                                                <div className="flex items-center gap-2">
                                                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
                                                        {activeSlideIndex + 1}
                                                    </span>
                                                    <h3 className="text-xs font-semibold text-foreground">
                                                        Edit Slide #{activeSlideIndex + 1}
                                                    </h3>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 rounded-lg"
                                                        disabled={activeSlideIndex === 0}
                                                        onClick={() => handleMoveSlide(activeSlideIndex, activeSlideIndex - 1)}
                                                        title="Move Slide Up"
                                                    >
                                                        <ArrowUp className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 rounded-lg"
                                                        disabled={activeSlideIndex === heroSlides.length - 1}
                                                        onClick={() => handleMoveSlide(activeSlideIndex, activeSlideIndex + 1)}
                                                        title="Move Slide Down"
                                                    >
                                                        <ArrowDown className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                                                        onClick={() => handleDuplicateSlide(activeSlideIndex)}
                                                        title="Duplicate Slide"
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10"
                                                        disabled={heroSlides.length <= 1}
                                                        onClick={() => handleDeleteSlide(activeSlideIndex)}
                                                        title="Delete Slide"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Slide Image Upload and Preview */}
                                            <div className="space-y-2">
                                                <Label className="text-xs font-medium">Slide Banner Image</Label>
                                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                                                    <div className="sm:col-span-5 h-28 rounded-xl border overflow-hidden relative group bg-muted/40 shadow-xs">
                                                        <img
                                                            src={resolveImageUrl(activeSlide.image)}
                                                            alt="Active slide preview"
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).src = PRESET_BANNERS[0].url;
                                                            }}
                                                        />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="secondary"
                                                                className="h-7 text-[11px] gap-1 rounded-lg"
                                                                onClick={() => singleSlideFileInputRef.current?.click()}
                                                                disabled={uploadingSlideId === activeSlide.id}
                                                            >
                                                                {uploadingSlideId === activeSlide.id ? (
                                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                                ) : (
                                                                    <Upload className="h-3 w-3" />
                                                                )}
                                                                Replace
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div className="sm:col-span-7 space-y-2.5">
                                                        <Button
                                                            type="button"
                                                            onClick={() => singleSlideFileInputRef.current?.click()}
                                                            disabled={uploadingSlideId === activeSlide.id}
                                                            className="w-full h-9 rounded-xl text-xs gap-2 font-medium"
                                                        >
                                                            {uploadingSlideId === activeSlide.id ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            ) : (
                                                                <Upload className="h-3.5 w-3.5" />
                                                            )}
                                                            <span>Upload Image from Computer</span>
                                                        </Button>

                                                        <div className="relative">
                                                            <Input
                                                                className="h-8 text-[11px] font-mono rounded-lg"
                                                                placeholder="Or enter image URL (https://...)"
                                                                value={activeSlide.image}
                                                                onChange={(e) => handleUpdateActiveSlide({ image: e.target.value })}
                                                            />
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground">
                                                            Recommended size: 1920×800px. High-resolution JPG, PNG or WebP.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Slide Texts: Headline & Subheadline */}
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div className="space-y-1.5">
                                                    <Label htmlFor={`slide-title-${activeSlide.id}`} className="text-xs font-medium">
                                                        Headline Title
                                                    </Label>
                                                    <Input
                                                        id={`slide-title-${activeSlide.id}`}
                                                        className="h-9 text-xs rounded-xl"
                                                        placeholder="e.g. Sweet Moments, Baked Daily"
                                                        value={activeSlide.title}
                                                        onChange={(e) => handleUpdateActiveSlide({ title: e.target.value })}
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label htmlFor={`slide-sub-${activeSlide.id}`} className="text-xs font-medium">
                                                        Sub-headline Text
                                                    </Label>
                                                    <Input
                                                        id={`slide-sub-${activeSlide.id}`}
                                                        className="h-9 text-xs rounded-xl"
                                                        placeholder="e.g. Delicious treats baked daily using premium ingredients"
                                                        value={activeSlide.subtitle}
                                                        onChange={(e) => handleUpdateActiveSlide({ subtitle: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            {/* CTA Button and Link */}
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div className="space-y-1.5">
                                                    <Label htmlFor={`slide-cta-${activeSlide.id}`} className="text-xs font-medium">
                                                        Call-to-Action Button Text
                                                    </Label>
                                                    <Input
                                                        id={`slide-cta-${activeSlide.id}`}
                                                        className="h-9 text-xs rounded-xl"
                                                        placeholder="e.g. Shop Now, Order Now"
                                                        value={activeSlide.ctaText || 'Shop Now'}
                                                        onChange={(e) => handleUpdateActiveSlide({ ctaText: e.target.value })}
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label htmlFor={`slide-link-${activeSlide.id}`} className="text-xs font-medium">
                                                        Button Link Destination
                                                    </Label>
                                                    <Input
                                                        id={`slide-link-${activeSlide.id}`}
                                                        className="h-9 text-xs rounded-xl"
                                                        placeholder="e.g. /products, /contact"
                                                        value={activeSlide.ctaLink || '/products'}
                                                        onChange={(e) => handleUpdateActiveSlide({ ctaLink: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            {/* Feature Logo on Slide Toggle */}
                                            <div className="flex items-center justify-between p-3 rounded-xl border bg-background">
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-semibold text-foreground">
                                                            Feature Brand Logo on this Slide
                                                        </span>
                                                        {settings.logoUrl && (
                                                            <div className="h-5 w-5 rounded border p-0.5 bg-muted/40 overflow-hidden">
                                                                <img
                                                                    src={resolveImageUrl(settings.logoUrl)}
                                                                    alt="Logo"
                                                                    className="h-full w-full object-contain"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        Display an elegant brand crest badge floating on top of this hero slide.
                                                    </p>
                                                </div>
                                                <Switch
                                                    checked={!!activeSlide.showLogo}
                                                    onCheckedChange={(checked) => handleUpdateActiveSlide({ showLogo: checked })}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Preset Banner Quick-Picks */}
                                    <div className="space-y-2 pt-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                Quick Preset Banner Library:
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">Click to apply to active slide</span>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {PRESET_BANNERS.map((preset) => {
                                                const isSelected = activeSlide?.image === preset.url;
                                                return (
                                                    <button
                                                        key={preset.name}
                                                        type="button"
                                                        onClick={() => handleUpdateActiveSlide({ image: preset.url })}
                                                        className={`group relative h-16 rounded-xl overflow-hidden border text-left transition-all ${
                                                            isSelected
                                                                ? 'ring-2 ring-primary border-primary shadow-sm'
                                                                : 'hover:opacity-90 border-border'
                                                        }`}
                                                    >
                                                        <img
                                                            src={preset.url}
                                                            alt={preset.name}
                                                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                                        />
                                                        <div className="absolute inset-0 bg-black/45 p-2 flex items-end">
                                                            <span className="text-[10px] font-semibold text-white drop-shadow">
                                                                {preset.name}
                                                            </span>
                                                        </div>
                                                        {isSelected && (
                                                            <div className="absolute top-1 right-1 h-3.5 w-3.5 rounded-full bg-primary flex items-center justify-center text-white">
                                                                <Check className="h-2 w-2" />
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* TAB: STOREFRONT IDENTITY & LOGO */}
                        <TabsContent value="branding" className="mt-4 space-y-4">
                            <Card className="rounded-2xl shadow-sm border">
                                <CardHeader className="p-5 pb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                            <Globe className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-sm font-semibold">Storefront Identity & Logo</CardTitle>
                                            <CardDescription className="text-xs">
                                                Upload your custom store logo and define how your store presents itself across headers and receipts.
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-5 pt-2 space-y-4">
                                    {/* Store Name */}
                                    <div className="space-y-1.5">
                                        <Label htmlFor="shopName" className="text-xs font-medium">Store Name</Label>
                                        <Input
                                            id="shopName"
                                            className="h-9 text-xs rounded-xl"
                                            placeholder="e.g. My Brand Store"
                                            value={settings.shopName}
                                            onChange={e => setSettings({ ...settings, shopName: e.target.value })}
                                        />
                                        <p className="text-[11px] text-muted-foreground">Appears on the top navigation bar, invoice receipts, and page titles.</p>
                                    </div>

                                    {/* Logo Upload Card Area */}
                                    <div className="space-y-2 pt-1">
                                        <Label className="text-xs font-medium">Store Logo</Label>
                                        <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                                            <div className="flex flex-col sm:flex-row items-center gap-4">
                                                {/* Logo Preview Container */}
                                                <div className="h-20 w-32 rounded-xl border bg-background/80 shadow-xs flex items-center justify-center p-2 relative shrink-0 overflow-hidden">
                                                    {settings.logoUrl ? (
                                                        <img
                                                            src={resolveImageUrl(settings.logoUrl)}
                                                            alt="Store Logo"
                                                            className="max-h-full max-w-full object-contain"
                                                            onError={e => { (e.target as HTMLElement).style.display = 'none'; }}
                                                        />
                                                    ) : (
                                                        <div className="text-center space-y-1 text-muted-foreground">
                                                            <Store className="h-6 w-6 mx-auto opacity-40" />
                                                            <span className="text-[10px] block">No logo set</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Upload Controls */}
                                                <div className="flex-1 space-y-2 text-center sm:text-left w-full">
                                                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                                                        <Button
                                                            type="button"
                                                            onClick={() => logoFileInputRef.current?.click()}
                                                            disabled={isUploadingLogo}
                                                            className="h-9 rounded-xl text-xs gap-2 shadow-xs"
                                                        >
                                                            {isUploadingLogo ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            ) : (
                                                                <Upload className="h-3.5 w-3.5" />
                                                            )}
                                                            <span>Upload Logo Image</span>
                                                        </Button>

                                                        {settings.logoUrl && (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                onClick={() => setSettings({ ...settings, logoUrl: '' })}
                                                                className="h-9 rounded-xl text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                            >
                                                                <X className="h-3.5 w-3.5 mr-1" />
                                                                Remove Logo
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        Supports transparent PNG, SVG, or high-res JPG. When set, replaces the text logo across your storefront.
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Manual Logo URL input fallback */}
                                            <div className="pt-2 border-t space-y-1">
                                                <Label htmlFor="logoUrl" className="text-[11px] text-muted-foreground">
                                                    Or specify direct Image URL:
                                                </Label>
                                                <Input
                                                    id="logoUrl"
                                                    className="h-8 text-[11px] rounded-lg font-mono"
                                                    placeholder="https://example.com/logo.png"
                                                    value={settings.logoUrl}
                                                    onChange={e => setSettings({ ...settings, logoUrl: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div className="space-y-1.5">
                                        <Label htmlFor="shopDescription" className="text-xs font-medium">Store Description / Tagline</Label>
                                        <Textarea
                                            id="shopDescription"
                                            rows={3}
                                            className="text-xs rounded-xl resize-none"
                                            placeholder="A short summary of what your store curates..."
                                            value={settings.shopDescription}
                                            onChange={e => setSettings({ ...settings, shopDescription: e.target.value })}
                                        />
                                        <div className="flex justify-between text-[11px] text-muted-foreground">
                                            <span>Shown in the storefront footer and social share cards.</span>
                                            <span>{settings.shopDescription?.length || 0} characters</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* TAB: THEME & COLOR */}
                        <TabsContent value="theme" className="mt-4 space-y-4">
                            {/* Theme Mode Card */}
                            <Card className="rounded-2xl shadow-sm border">
                                <CardHeader className="p-5 pb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                            {settings.themeMode === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <CardTitle className="text-sm font-semibold">Storefront Theme Mode</CardTitle>
                                            <CardDescription className="text-xs">
                                                Default presentation mode experienced by online visitors.
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-5 pt-2">
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            {
                                                id: 'light',
                                                title: 'Light Theme',
                                                desc: 'Fresh, bright & clean aesthetic',
                                                icon: Sun,
                                            },
                                            {
                                                id: 'dark',
                                                title: 'Dark Theme',
                                                desc: 'Sleek, high-contrast luxury',
                                                icon: Moon,
                                            },
                                            {
                                                id: 'system',
                                                title: 'System Sync',
                                                desc: 'Adapts to customer device OS',
                                                icon: Laptop,
                                            },
                                        ].map((m) => {
                                            const Icon = m.icon;
                                            const active = (settings.themeMode || 'light') === m.id;
                                            return (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => setSettings({ ...settings, themeMode: m.id as any })}
                                                    className={`group relative flex flex-col items-center justify-between p-3.5 rounded-xl border text-center transition-all ${
                                                        active
                                                            ? 'border-primary bg-primary/5 ring-2 ring-primary/30 shadow-sm'
                                                            : 'border-border bg-card hover:bg-muted/40 text-foreground'
                                                    }`}
                                                >
                                                    <div className="flex flex-col items-center w-full">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-transform group-hover:scale-105 ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                                            <Icon className="h-4 w-4" />
                                                        </div>
                                                        <span className="text-xs font-semibold">{m.title}</span>
                                                        <span className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{m.desc}</span>
                                                    </div>

                                                    {active && (
                                                        <div className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                                            <Check className="h-2.5 w-2.5" />
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Color Palette Card */}
                            <Card className="rounded-2xl shadow-sm border">
                                <CardHeader className="p-5 pb-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                                <Palette className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-sm font-semibold">Brand Accent Color Palette</CardTitle>
                                                <CardDescription className="text-xs">
                                                    Applied to "Add to Cart" buttons, badges, promotional banners, and active links.
                                                </CardDescription>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="text-xs font-mono" style={{ borderColor: currentPalette.hex, color: currentPalette.hex }}>
                                            {currentPalette.name}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-5 pt-2">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {ECOMMERCE_THEME_COLORS.map((color) => {
                                            const active = (settings.primaryColor || 'vibrant-pink') === color.id;
                                            return (
                                                <button
                                                    key={color.id}
                                                    type="button"
                                                    onClick={() => setSettings({ ...settings, primaryColor: color.id })}
                                                    className={`group relative flex flex-col items-center p-3 rounded-xl border text-center transition-all ${
                                                        active
                                                            ? 'border-primary bg-primary/5 ring-2 ring-primary/30 shadow-sm'
                                                            : 'border-border bg-card hover:bg-muted/40'
                                                    }`}
                                                >
                                                    <div
                                                        className="w-9 h-9 rounded-full mb-2 shadow-sm flex items-center justify-center transition-transform group-hover:scale-110 border border-black/10"
                                                        style={{ backgroundColor: color.hex }}
                                                    >
                                                        {active && <Check className="h-4 w-4 text-white drop-shadow" />}
                                                    </div>
                                                    <span className="text-xs font-semibold text-foreground truncate w-full">
                                                        {color.name}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                                        {color.hex}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* TAB: CONTACT & FOOTER */}
                        <TabsContent value="contact" className="mt-4 space-y-4">
                            <Card className="rounded-2xl shadow-sm border">
                                <CardHeader className="p-5 pb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                            <Phone className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-sm font-semibold">Customer Contact & Footer</CardTitle>
                                            <CardDescription className="text-xs">
                                                Public support channels and legal copyright lines for the customer footer.
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-5 pt-2 space-y-4">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="contactEmail" className="text-xs font-medium">Customer Support Email</Label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                <Input
                                                    id="contactEmail"
                                                    type="email"
                                                    className="h-9 pl-9 text-xs rounded-xl"
                                                    placeholder="support@example.com"
                                                    value={settings.contactEmail}
                                                    onChange={e => setSettings({ ...settings, contactEmail: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="contactPhone" className="text-xs font-medium">Support Phone / WhatsApp</Label>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                <Input
                                                    id="contactPhone"
                                                    className="h-9 pl-9 text-xs rounded-xl"
                                                    placeholder="+254 700 000 000"
                                                    value={settings.contactPhone}
                                                    onChange={e => setSettings({ ...settings, contactPhone: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="footerText" className="text-xs font-medium">Footer Copyright Text</Label>
                                        <Input
                                            id="footerText"
                                            className="h-9 text-xs rounded-xl"
                                            placeholder={`© ${new Date().getFullYear()} ${settings.shopName || 'Store'}. All rights reserved.`}
                                            value={settings.footerText}
                                            onChange={e => setSettings({ ...settings, footerText: e.target.value })}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>

                    {/* Bottom Save Reminder Card */}
                    <div className="rounded-xl border bg-muted/30 p-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <span>Preview changes on the right before publishing live to customers.</span>
                        </div>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            size="sm"
                            className="h-8 rounded-lg text-xs gap-1.5 shadow-sm"
                        >
                            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Publish Live
                        </Button>
                    </div>
                </div>

                {/* Live Storefront Mockup (Right, 5 Cols, Sticky) */}
                <div className="xl:col-span-5 xl:sticky xl:top-24 space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-primary" />
                            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                                Live Storefront Preview
                            </span>
                        </div>

                        {/* Theme and Device switcher for Preview */}
                        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border">
                            <button
                                type="button"
                                onClick={() => setPreviewThemeOverride('light')}
                                className={`p-1 rounded-md transition-colors ${previewMode === 'light' ? 'bg-background shadow-xs text-amber-500' : 'text-muted-foreground hover:text-foreground'}`}
                                title="Preview in Light Mode"
                            >
                                <Sun className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setPreviewThemeOverride('dark')}
                                className={`p-1 rounded-md transition-colors ${previewMode === 'dark' ? 'bg-background shadow-xs text-blue-400' : 'text-muted-foreground hover:text-foreground'}`}
                                title="Preview in Dark Mode"
                            >
                                <Moon className="h-3.5 w-3.5" />
                            </button>
                            <div className="w-[1px] h-3 bg-border mx-0.5" />
                            <button
                                type="button"
                                onClick={() => setPreviewDevice('desktop')}
                                className={`p-1 rounded-md transition-colors ${previewDevice === 'desktop' ? 'bg-background shadow-xs text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                title="Desktop View"
                            >
                                <Monitor className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setPreviewDevice('mobile')}
                                className={`p-1 rounded-md transition-colors ${previewDevice === 'mobile' ? 'bg-background shadow-xs text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                title="Mobile View"
                            >
                                <Smartphone className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Mockup Frame */}
                    <div className={`mx-auto transition-all duration-300 ${previewDevice === 'mobile' ? 'max-w-[320px]' : 'w-full'}`}>
                        <div className={`overflow-hidden rounded-2xl border shadow-xl transition-colors duration-200 ${
                            previewMode === 'dark' ? 'bg-slate-950 text-slate-100 border-slate-800' : 'bg-white text-slate-900 border-gray-200'
                        }`}>
                            {/* Browser chrome header */}
                            <div className={`px-3 py-2 border-b flex items-center justify-between text-[10px] ${
                                previewMode === 'dark' ? 'bg-slate-900/90 border-slate-800 text-slate-400' : 'bg-gray-100/80 border-gray-200 text-gray-500'
                            }`}>
                                <div className="flex items-center gap-1.5">
                                    <div className="h-2 w-2 rounded-full bg-red-400/80" />
                                    <div className="h-2 w-2 rounded-full bg-amber-400/80" />
                                    <div className="h-2 w-2 rounded-full bg-emerald-400/80" />
                                </div>
                                <div className={`px-2.5 py-0.5 rounded-md font-mono text-[9px] flex items-center gap-1 truncate max-w-[170px] ${
                                    previewMode === 'dark' ? 'bg-slate-950 text-slate-300' : 'bg-white text-gray-600 border border-gray-200/60'
                                }`}>
                                    <span className="text-emerald-500 font-bold">🔒</span>
                                    <span>{typeof window !== 'undefined' ? window.location.host : 'store.com'}</span>
                                </div>
                                <div className="w-6" />
                            </div>

                            {/* Storefront Navigation Bar Mockup */}
                            <div className={`px-3.5 py-2.5 border-b flex items-center justify-between ${
                                previewMode === 'dark' ? 'border-slate-800/80 bg-slate-950/80' : 'border-gray-100 bg-white/90'
                            }`}>
                                <div className="flex items-center gap-2">
                                    {settings.logoUrl ? (
                                        <img
                                            src={resolveImageUrl(settings.logoUrl)}
                                            alt="Logo"
                                            className="h-5 w-auto object-contain"
                                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                        />
                                    ) : (
                                        <div
                                            className="h-5 w-5 rounded-md flex items-center justify-center text-white text-[10px] font-bold"
                                            style={{ backgroundColor: currentPalette.hex }}
                                        >
                                            {settings.shopName?.charAt(0) || 'S'}
                                        </div>
                                    )}
                                    <span
                                        className="text-xs font-bold tracking-tight"
                                        style={{ color: currentPalette.hex }}
                                    >
                                        {settings.shopName || "My Store"}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Search className="h-3.5 w-3.5 opacity-60" />
                                    <Heart className="h-3.5 w-3.5 opacity-60" />
                                    <div className="relative">
                                        <ShoppingBag className="h-3.5 w-3.5 opacity-80" />
                                        <span
                                            className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full flex items-center justify-center text-[7px] font-bold text-white"
                                            style={{ backgroundColor: currentPalette.hex }}
                                        >
                                            2
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Hero Slider Mockup (With sliding images and logo overlay) */}
                            <div
                                className="relative h-48 overflow-hidden flex items-center justify-center text-center p-4 group"
                                onMouseEnter={() => setIsPreviewHovered(true)}
                                onMouseLeave={() => setIsPreviewHovered(false)}
                            >
                                <img
                                    key={currentPreview.id}
                                    src={resolveImageUrl(currentPreview.image)}
                                    alt="Hero Banner"
                                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 animate-in fade-in"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = PRESET_BANNERS[0].url;
                                    }}
                                />
                                <div className={`absolute inset-0 ${
                                    previewMode === 'dark'
                                        ? 'bg-gradient-to-t from-slate-950 via-slate-950/65 to-slate-950/40'
                                        : 'bg-gradient-to-t from-black/80 via-black/45 to-black/30'
                                }`} />

                                {/* Slide content */}
                                <div className="relative z-10 space-y-1.5 max-w-xs mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    {/* Logo Badge Overlay on Slide */}
                                    {currentPreview.showLogo && settings.logoUrl && (
                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/90 dark:bg-black/80 backdrop-blur-md shadow-sm mb-0.5">
                                            <img
                                                src={resolveImageUrl(settings.logoUrl)}
                                                alt="Logo Badge"
                                                className="h-3.5 w-auto object-contain"
                                            />
                                            <span className="text-[9px] font-bold tracking-tight text-slate-900 dark:text-white">
                                                {settings.shopName}
                                            </span>
                                        </div>
                                    )}

                                    {!currentPreview.showLogo && (
                                        <span
                                            className="inline-block text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full text-white shadow-sm"
                                            style={{ backgroundColor: currentPalette.hex }}
                                        >
                                            Slide #{previewSlideIndex + 1}
                                        </span>
                                    )}

                                    <h3 className="text-sm font-bold text-white leading-tight drop-shadow-sm line-clamp-2">
                                        {currentPreview.title || 'Feel Confident, Stay Comfortable'}
                                    </h3>
                                    <p className="text-[10px] text-white/80 line-clamp-2 leading-relaxed">
                                        {currentPreview.subtitle || 'Discover our new season collection crafted with care.'}
                                    </p>
                                    <div className="pt-1">
                                        <button
                                            type="button"
                                            className="px-3 py-1 rounded-full text-[10px] font-bold text-white shadow-md transition-transform hover:scale-105"
                                            style={{ backgroundColor: currentPalette.hex }}
                                        >
                                            {currentPreview.ctaText || 'Shop Collection'} →
                                        </button>
                                    </div>
                                </div>

                                {/* Slide Navigation Chevrons in Preview */}
                                {heroSlides.length > 1 && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPreviewSlideIndex((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
                                            }}
                                            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 h-6 w-6 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-all opacity-70 group-hover:opacity-100"
                                            aria-label="Previous slide"
                                        >
                                            <ChevronLeft className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPreviewSlideIndex((prev) => (prev + 1) % heroSlides.length);
                                            }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 h-6 w-6 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-all opacity-70 group-hover:opacity-100"
                                            aria-label="Next slide"
                                        >
                                            <ChevronRight className="h-3.5 w-3.5" />
                                        </button>

                                        {/* Pagination Dots */}
                                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
                                            {heroSlides.map((_, dotIdx) => (
                                                <button
                                                    key={dotIdx}
                                                    type="button"
                                                    onClick={() => setPreviewSlideIndex(dotIdx)}
                                                    className={`h-1 rounded-full transition-all duration-300 ${
                                                        dotIdx === previewSlideIndex
                                                            ? 'w-4 bg-white'
                                                            : 'w-1 bg-white/40 hover:bg-white/70'
                                                    }`}
                                                    aria-label={`Go to slide ${dotIdx + 1}`}
                                                />
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Sample Product Card Mockup */}
                            <div className={`p-3.5 space-y-2 ${previewMode === 'dark' ? 'bg-slate-900/50' : 'bg-gray-50/60'}`}>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">Featured Spotlight</span>
                                    <span className="text-[9px] font-medium" style={{ color: currentPalette.hex }}>View all</span>
                                </div>

                                <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                                    previewMode === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200/80 shadow-xs'
                                }`}>
                                    <div className="flex items-center gap-2.5">
                                        <div className="h-10 w-10 rounded-lg overflow-hidden bg-muted/40 shrink-0 border">
                                            <img
                                                src={PRESET_BANNERS[0].url}
                                                alt="Item"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-[11px] font-semibold leading-none truncate max-w-[130px]">
                                                Special Celebration Treat
                                            </p>
                                            <p className="text-[10px] font-bold" style={{ color: currentPalette.hex }}>
                                                KES 3,500
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="h-7 px-2.5 rounded-lg text-[9px] font-bold text-white shrink-0 shadow-xs flex items-center gap-1"
                                        style={{ backgroundColor: currentPalette.hex }}
                                    >
                                        <ShoppingBag className="h-2.5 w-2.5" />
                                        Add
                                    </button>
                                </div>
                            </div>

                            {/* Mini Footer Mockup */}
                            <div className={`px-3.5 py-3 border-t text-center space-y-1 text-[9px] ${
                                previewMode === 'dark' ? 'border-slate-800 bg-slate-950 text-slate-400' : 'border-gray-100 bg-gray-50 text-gray-500'
                            }`}>
                                <div className="flex items-center justify-center gap-3 text-[9px] opacity-80">
                                    <span>{settings.contactEmail || 'contact@store.com'}</span>
                                    <span>•</span>
                                    <span>{settings.contactPhone || '+254 700 000 000'}</span>
                                </div>
                                <p className="opacity-60 text-[8px] truncate">
                                    {settings.footerText}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
