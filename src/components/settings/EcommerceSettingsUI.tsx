import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { EcommerceSettings } from '@/types/inventory';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Layout, Globe, Image as ImageIcon, Phone, Mail, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function EcommerceSettingsUI() {
    const [settings, setSettings] = useState<EcommerceSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const data = await apiFetch<EcommerceSettings>('/api/ecommerce-settings');
            setSettings(data);
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
            toast.success('eCommerce settings updated');
        } catch (error) {
            toast.error('Failed to update settings');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading || !settings) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* General Settings */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <Globe className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle>General eCommerce Shop Info</CardTitle>
                            <CardDescription>Setup your online store identity</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="shopName">Shop Name</Label>
                            <Input
                                id="shopName"
                                value={settings.shopName}
                                onChange={e => setSettings({ ...settings, shopName: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="logoUrl">Logo URL</Label>
                            <Input
                                id="logoUrl"
                                placeholder="https://example.com/logo.png"
                                value={settings.logoUrl}
                                onChange={e => setSettings({ ...settings, logoUrl: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="shopDesc">Shop Description</Label>
                        <Textarea
                            id="shopDesc"
                            rows={3}
                            value={settings.shopDescription}
                            onChange={e => setSettings({ ...settings, shopDescription: e.target.value })}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Hero Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <ImageIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle>Hero Section (Main Banner)</CardTitle>
                            <CardDescription>Customize the first section users see on the home page</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="heroTitle">Hero Title</Label>
                        <Input
                            id="heroTitle"
                            value={settings.heroTitle}
                            onChange={e => setSettings({ ...settings, heroTitle: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="heroSubtitle">Hero Subtitle</Label>
                        <Input
                            id="heroSubtitle"
                            value={settings.heroSubtitle}
                            onChange={e => setSettings({ ...settings, heroSubtitle: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="heroBanner">Hero Banner URL</Label>
                        <Input
                            id="heroBanner"
                            placeholder="https://example.com/banner.jpg"
                            value={settings.heroBannerUrl}
                            onChange={e => setSettings({ ...settings, heroBannerUrl: e.target.value })}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Contact & Footer */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <Phone className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle>Contact & Footer</CardTitle>
                            <CardDescription>Manage how customers contact you and the site footer</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="cEmail">Contact Email</Label>
                            <Input
                                id="cEmail"
                                type="email"
                                value={settings.contactEmail}
                                onChange={e => setSettings({ ...settings, contactEmail: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cPhone">Contact Phone</Label>
                            <Input
                                id="cPhone"
                                value={settings.contactPhone}
                                onChange={e => setSettings({ ...settings, contactPhone: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="footerText">Footer Text</Label>
                        <Input
                            id="footerText"
                            value={settings.footerText}
                            onChange={e => setSettings({ ...settings, footerText: e.target.value })}
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving} className="w-full md:w-auto">
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save eCommerce Settings
                </Button>
            </div>
        </div>
    );
}
