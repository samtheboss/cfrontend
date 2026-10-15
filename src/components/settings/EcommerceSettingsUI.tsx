import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { EcommerceSettings } from '@/types/inventory';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    SlidersHorizontal,
    Monitor,
    Smartphone
} from 'lucide-react';
import { toast } from 'sonner';

export const ECOMMERCE_THEME_COLORS = [
    {
        id: 'vibrant-pink',
        name: 'Rose Romance',
        hex: '#ec4899',
        gradient: 'from-pink-500 to-rose-400',
        desc: 'Vibrant pink & rose tones, ideal for lingerie and luxury fashion',
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
        name: 'Silk & Satin',
        url: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&q=80&w=1400',
    },
    {
        name: 'Fashion Boutique',
        url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=1400',
    },
    {
        name: 'Artisan Bakery',
        url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=1400',
    },
    {
        name: 'Modern Luxury',
        url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=80&w=1400',
    },
];

export default function EcommerceSettingsUI() {
    const [settings, setSettings] = useState<EcommerceSettings | null>(null);
    const [initialSettings, setInitialSettings] = useState<EcommerceSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('branding');
    const [previewThemeOverride, setPreviewThemeOverride] = useState<'light' | 'dark' | null>(null);
    const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const data = await apiFetch<EcommerceSettings>('/api/ecommerce-settings');
            const sanitized: EcommerceSettings = {
                ...data,
                shopName: data.shopName || "Ella's Comfie",
                shopDescription: data.shopDescription || 'Luxury Intimates, Sleepwear & Curated Comfort',
                heroTitle: data.heroTitle || 'Feel Confident, Stay Comfortable',
                heroSubtitle: data.heroSubtitle || 'Discover our new season collection crafted with ultra-soft fabrics.',
                heroBannerUrl: data.heroBannerUrl || PRESET_BANNERS[0].url,
                themeMode: data.themeMode || 'light',
                primaryColor: data.primaryColor || 'vibrant-pink',
                contactEmail: data.contactEmail || 'care@ellascomfie.com',
                contactPhone: data.contactPhone || '+254 700 000 000',
                footerText: data.footerText || `© ${new Date().getFullYear()} Ella's Comfie. All rights reserved.`,
            };
            setSettings(sanitized);
            setInitialSettings(sanitized);
        } catch (error) {
            toast.error('Failed to load eCommerce settings');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!settings) return;
        setIsSaving(true);
        try {
            await apiFetch('/api/ecommerce-settings', {
                method: 'PUT',
                body: JSON.stringify(settings),
            });
            setInitialSettings(settings);
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
            toast.info('Restored saved eCommerce settings');
        }
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

    return (
        <div className="space-y-6 pb-12">
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
                            Customize your online shop's identity, visual branding colors, hero banner showcase, and customer contact details with instant live preview.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs h-9 rounded-xl hover:bg-secondary/60"
                            onClick={() => window.open('https://ellascomfie.com', '_blank')}
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
                            <TabsTrigger value="branding" className="text-xs font-medium rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                <Globe className="h-3.5 w-3.5" />
                                <span>Identity</span>
                            </TabsTrigger>
                            <TabsTrigger value="theme" className="text-xs font-medium rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                <Palette className="h-3.5 w-3.5" />
                                <span>Theme & Color</span>
                            </TabsTrigger>
                            <TabsTrigger value="hero" className="text-xs font-medium rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                <ImageIcon className="h-3.5 w-3.5" />
                                <span>Hero Showcase</span>
                            </TabsTrigger>
                            <TabsTrigger value="contact" className="text-xs font-medium rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                <Phone className="h-3.5 w-3.5" />
                                <span>Contact & Footer</span>
                            </TabsTrigger>
                        </TabsList>

                        {/* Tab 1: Identity & Branding */}
                        <TabsContent value="branding" className="mt-4 space-y-4">
                            <Card className="rounded-2xl shadow-sm border">
                                <CardHeader className="p-5 pb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                            <Globe className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-sm font-semibold">Storefront Identity</CardTitle>
                                            <CardDescription className="text-xs">
                                                Define how your store presents itself on browser tabs, headers, and SEO.
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-5 pt-2 space-y-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="shopName" className="text-xs font-medium">Store Name</Label>
                                        <Input
                                            id="shopName"
                                            className="h-9 text-xs rounded-xl"
                                            placeholder="e.g. Ella's Comfie"
                                            value={settings.shopName}
                                            onChange={e => setSettings({ ...settings, shopName: e.target.value })}
                                        />
                                        <p className="text-[11px] text-muted-foreground">Appears on the top navigation bar, invoice receipts, and page titles.</p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="logoUrl" className="text-xs font-medium">Logo URL</Label>
                                        <div className="flex gap-3 items-center">
                                            <div className="flex-1">
                                                <Input
                                                    id="logoUrl"
                                                    className="h-9 text-xs rounded-xl font-mono text-[11px]"
                                                    placeholder="https://example.com/logo.png"
                                                    value={settings.logoUrl}
                                                    onChange={e => setSettings({ ...settings, logoUrl: e.target.value })}
                                                />
                                            </div>
                                            {settings.logoUrl && (
                                                <div className="h-9 w-9 rounded-xl border bg-muted/40 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                                                    <img
                                                        src={settings.logoUrl}
                                                        alt="Logo"
                                                        className="h-full w-full object-contain"
                                                        onError={e => { (e.target as HTMLElement).style.display = 'none'; }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground">Leave blank to display the stylish gradient text logo automatically.</p>
                                    </div>

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

                        {/* Tab 2: Theme & Visual Styling */}
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
                                                bgPreview: 'bg-white border-gray-200 text-gray-900',
                                            },
                                            {
                                                id: 'dark',
                                                title: 'Dark Theme',
                                                desc: 'Sleek, high-contrast luxury',
                                                icon: Moon,
                                                bgPreview: 'bg-slate-900 border-slate-700 text-white',
                                            },
                                            {
                                                id: 'system',
                                                title: 'System Sync',
                                                desc: 'Adapts to customer device OS',
                                                icon: Laptop,
                                                bgPreview: 'bg-gradient-to-r from-white to-slate-900 border-gray-300 text-gray-800',
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

                        {/* Tab 3: Hero Showcase & Banners */}
                        <TabsContent value="hero" className="mt-4 space-y-4">
                            <Card className="rounded-2xl shadow-sm border">
                                <CardHeader className="p-5 pb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                            <ImageIcon className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-sm font-semibold">Homepage Hero Showcase</CardTitle>
                                            <CardDescription className="text-xs">
                                                Craft the primary promotional billboard visitors see upon entering your website.
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-5 pt-2 space-y-4">
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="heroTitle" className="text-xs font-medium">Hero Headline</Label>
                                            <Input
                                                id="heroTitle"
                                                className="h-9 text-xs rounded-xl"
                                                placeholder="e.g. Feel Confident, Stay Comfortable"
                                                value={settings.heroTitle}
                                                onChange={e => setSettings({ ...settings, heroTitle: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="heroSubtitle" className="text-xs font-medium">Hero Sub-headline</Label>
                                            <Input
                                                id="heroSubtitle"
                                                className="h-9 text-xs rounded-xl"
                                                placeholder="e.g. Discover our luxury intimates & sleepwear"
                                                value={settings.heroSubtitle}
                                                onChange={e => setSettings({ ...settings, heroSubtitle: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="heroBanner" className="text-xs font-medium">Hero Banner Image URL</Label>
                                        <Input
                                            id="heroBanner"
                                            className="h-9 text-xs rounded-xl font-mono text-[11px]"
                                            placeholder="https://images.unsplash.com/..."
                                            value={settings.heroBannerUrl}
                                            onChange={e => setSettings({ ...settings, heroBannerUrl: e.target.value })}
                                        />
                                    </div>

                                    {/* Preset Banner Quick-Picks */}
                                    <div className="space-y-2 pt-1">
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Quick Preset Banners:</span>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {PRESET_BANNERS.map((preset) => (
                                                <button
                                                    key={preset.name}
                                                    type="button"
                                                    onClick={() => setSettings({ ...settings, heroBannerUrl: preset.url })}
                                                    className={`group relative h-16 rounded-xl overflow-hidden border text-left transition-all ${
                                                        settings.heroBannerUrl === preset.url
                                                            ? 'ring-2 ring-primary border-primary shadow-sm'
                                                            : 'hover:opacity-90 border-border'
                                                    }`}
                                                >
                                                    <img
                                                        src={preset.url}
                                                        alt={preset.name}
                                                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 p-2 flex items-end">
                                                        <span className="text-[10px] font-semibold text-white drop-shadow">
                                                            {preset.name}
                                                        </span>
                                                    </div>
                                                    {settings.heroBannerUrl === preset.url && (
                                                        <div className="absolute top-1 right-1 h-3.5 w-3.5 rounded-full bg-primary flex items-center justify-center text-white">
                                                            <Check className="h-2 w-2" />
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Tab 4: Contact & Footer */}
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
                                                    placeholder="support@ellascomfie.com"
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
                                            placeholder={`© ${new Date().getFullYear()} Ella's Comfie. All rights reserved.`}
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
                                    <span>ellascomfie.com</span>
                                </div>
                                <div className="w-6" />
                            </div>

                            {/* Storefront Navigation Bar Mockup */}
                            <div className={`px-3.5 py-2.5 border-b flex items-center justify-between ${
                                previewMode === 'dark' ? 'border-slate-800/80 bg-slate-950/80' : 'border-gray-100 bg-white/90'
                            }`}>
                                <div className="flex items-center gap-2">
                                    {settings.logoUrl ? (
                                        <img src={settings.logoUrl} alt="Logo" className="h-5 w-auto object-contain" />
                                    ) : (
                                        <div
                                            className="h-5 w-5 rounded-md flex items-center justify-center text-white text-[10px] font-bold"
                                            style={{ backgroundColor: currentPalette.hex }}
                                        >
                                            {settings.shopName?.charAt(0) || 'E'}
                                        </div>
                                    )}
                                    <span
                                        className="text-xs font-bold tracking-tight"
                                        style={{ color: currentPalette.hex }}
                                    >
                                        {settings.shopName || "Ella's Comfie"}
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

                            {/* Hero Banner Mockup */}
                            <div className="relative h-44 overflow-hidden flex items-center justify-center text-center p-4">
                                <img
                                    src={settings.heroBannerUrl || PRESET_BANNERS[0].url}
                                    alt="Hero"
                                    className="absolute inset-0 w-full h-full object-cover"
                                />
                                <div className={`absolute inset-0 ${
                                    previewMode === 'dark'
                                        ? 'bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/40'
                                        : 'bg-gradient-to-t from-black/80 via-black/45 to-black/30'
                                }`} />

                                <div className="relative z-10 space-y-1.5 max-w-xs mx-auto">
                                    <span
                                        className="inline-block text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full text-white shadow-sm"
                                        style={{ backgroundColor: currentPalette.hex }}
                                    >
                                        New Collection
                                    </span>
                                    <h3 className="text-sm font-bold text-white leading-tight drop-shadow-sm line-clamp-2">
                                        {settings.heroTitle || 'Feel Confident, Stay Comfortable'}
                                    </h3>
                                    <p className="text-[10px] text-white/80 line-clamp-2 leading-relaxed">
                                        {settings.heroSubtitle || 'Luxury intimates & sleepwear designed for you.'}
                                    </p>
                                    <div className="pt-1">
                                        <button
                                            type="button"
                                            className="px-3 py-1 rounded-full text-[10px] font-bold text-white shadow-md transition-transform hover:scale-105"
                                            style={{ backgroundColor: currentPalette.hex }}
                                        >
                                            Shop Collection →
                                        </button>
                                    </div>
                                </div>
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
                                                Silk Satin Lounge Set
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
                                    <span>{settings.contactEmail}</span>
                                    <span>•</span>
                                    <span>{settings.contactPhone}</span>
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
