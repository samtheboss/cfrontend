import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Plus, Search, Edit, Trash2, Globe, Eye, Upload, Sparkles, BookOpen, Clock, Tag, ExternalLink } from 'lucide-react';
import { apiFetch, getBaseUrl } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RichTextEditor } from '@/components/ui/RichTextEditor';

export interface AdminBlogPost {
    id?: number;
    title: string;
    slug: string;
    summary?: string;
    content: string;
    featuredImage?: string;
    imageAlt?: string;
    author?: string;
    category?: string;
    tags?: string;
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string;
    readTimeMinutes?: number;
    isPublished: boolean;
    publishedAt?: string;
    relatedProductIds?: string;
    createdAt?: string;
    updatedAt?: string;
}

interface ProductOption {
    id: number;
    name: string;
    category?: string;
}

export default function Blogs() {
    const { toast } = useToast();
    const [posts, setPosts] = useState<AdminBlogPost[]>([]);
    const [products, setProducts] = useState<ProductOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    const [formState, setFormState] = useState<AdminBlogPost>({
        title: '',
        slug: '',
        summary: '',
        content: '',
        featuredImage: '',
        imageAlt: '',
        author: 'Editorial Team',
        category: 'Guides & Articles',
        tags: '',
        metaTitle: '',
        metaDescription: '',
        metaKeywords: '',
        readTimeMinutes: 5,
        isPublished: true,
        relatedProductIds: '',
    });

    const fetchPosts = async () => {
        setIsLoading(true);
        try {
            const res = await apiFetch<{ data: AdminBlogPost[] }>('/api/blogs/all');
            setPosts(res.data || []);
        } catch (error) {
            console.error('Failed to load blog posts:', error);
            toast({
                title: 'Error',
                description: 'Failed to load blog articles.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await apiFetch<{ data: ProductOption[] }>('/api/products');
            setProducts(res.data || []);
        } catch {
            // optional
        }
    };

    useEffect(() => {
        fetchPosts();
        fetchProducts();
    }, []);

    const handleTitleChange = (val: string) => {
        const slugified = val
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');

        setFormState((prev) => ({
            ...prev,
            title: val,
            slug: editingId ? prev.slug : slugified,
            metaTitle: prev.metaTitle || val,
        }));
    };

    const handleSummaryChange = (val: string) => {
        setFormState((prev) => ({
            ...prev,
            summary: val,
            metaDescription: prev.metaDescription || val,
        }));
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            setIsUploadingImage(true);
            const data = await apiFetch<{ url: string }>('/api/upload', {
                method: 'POST',
                body: formData,
            });

            setFormState((prev) => ({
                ...prev,
                featuredImage: data.url,
                imageAlt: prev.imageAlt || prev.title,
            }));

            toast({
                title: 'Image uploaded',
                description: 'Featured article image has been uploaded successfully.',
            });
        } catch (error) {
            toast({
                title: 'Upload Failed',
                description: 'Could not upload image.',
                variant: 'destructive',
            });
        } finally {
            setIsUploadingImage(false);
        }
    };

    const handleSave = async () => {
        if (!formState.title.trim()) {
            toast({
                title: 'Title required',
                description: 'Please enter a title for the article.',
                variant: 'destructive',
            });
            return;
        }

        try {
            await apiFetch('/api/blogs', {
                method: 'POST',
                body: JSON.stringify(formState),
            });

            toast({
                title: 'Article Saved',
                description: editingId ? 'Article updated successfully.' : 'Article published successfully.',
            });

            setIsDialogOpen(false);
            resetForm();
            fetchPosts();
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to save blog post.',
                variant: 'destructive',
            });
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this blog post?')) return;
        try {
            await apiFetch(`/api/blogs/${id}`, {
                method: 'DELETE',
            });
            toast({
                title: 'Deleted',
                description: 'Article deleted successfully.',
            });
            fetchPosts();
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to delete article.',
                variant: 'destructive',
            });
        }
    };

    const handleEdit = (post: AdminBlogPost) => {
        setEditingId(post.id || null);
        setFormState(post);
        setIsDialogOpen(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setFormState({
            title: '',
            slug: '',
            summary: '',
            content: '',
            featuredImage: '',
            imageAlt: '',
            author: 'Editorial Team',
            category: 'Guides & Articles',
            tags: '',
            metaTitle: '',
            metaDescription: '',
            metaKeywords: '',
            readTimeMinutes: 5,
            isPublished: true,
            relatedProductIds: '',
        });
    };

    const filteredPosts = posts.filter(
        (p) =>
            p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (p.tags && p.tags.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const getFullImageUrl = (path?: string) => {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        return `${getBaseUrl()}${path}`;
    };

    return (
        <AppLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <BookOpen className="w-6 h-6 text-primary" />
                            Blog & SEO Content Engine
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Write rich guides, styling tips, and product stories to increase Google organic traffic and sales.
                        </p>
                    </div>
                    <Button
                        onClick={() => {
                            resetForm();
                            setIsDialogOpen(true);
                        }}
                        className="gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Write New Article
                    </Button>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by title, category, or tags..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <div className="text-xs text-muted-foreground ml-auto">
                        Total articles: <strong className="text-foreground">{posts.length}</strong>
                    </div>
                </div>

                {/* Articles Table */}
                <Card>
                    <CardHeader className="p-4 sm:p-6 pb-2">
                        <CardTitle className="text-lg">Published & Draft Content</CardTitle>
                        <CardDescription>All articles indexed by search engines and displayed on the storefront.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 sm:p-6 sm:pt-0">
                        {isLoading ? (
                            <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">
                                Loading blog articles...
                            </div>
                        ) : filteredPosts.length === 0 ? (
                            <div className="p-12 text-center">
                                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                                <h3 className="font-semibold text-foreground">No blog posts found</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Click "Write New Article" to create your first content guide.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-secondary/40 text-xs font-semibold text-muted-foreground uppercase">
                                        <tr>
                                            <th className="py-3 px-4">Article</th>
                                            <th className="py-3 px-4">Category</th>
                                            <th className="py-3 px-4">Status</th>
                                            <th className="py-3 px-4">Read Time</th>
                                            <th className="py-3 px-4">SEO Score</th>
                                            <th className="py-3 px-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {filteredPosts.map((post) => {
                                            const hasSeo = Boolean(post.metaTitle && post.metaDescription);
                                            return (
                                                <tr key={post.id} className="hover:bg-secondary/20 transition-colors">
                                                    <td className="py-3.5 px-4">
                                                        <div className="flex items-center gap-3">
                                                            {post.featuredImage ? (
                                                                <img
                                                                    src={getFullImageUrl(post.featuredImage)}
                                                                    alt={post.title}
                                                                    className="w-12 h-12 rounded-lg object-cover bg-secondary"
                                                                />
                                                            ) : (
                                                                <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                                                                    <BookOpen className="w-5 h-5 opacity-40" />
                                                                </div>
                                                            )}
                                                            <div>
                                                                <div className="font-semibold text-foreground line-clamp-1">{post.title}</div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    /blog/{post.slug}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-muted-foreground">
                                                        <Badge variant="outline">{post.category || 'General'}</Badge>
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        {post.isPublished ? (
                                                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                                                                Published
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="secondary">Draft</Badge>
                                                        )}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-muted-foreground text-xs">
                                                        {post.readTimeMinutes || 5} min read
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        {hasSeo ? (
                                                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                                                <Sparkles className="w-3.5 h-3.5" /> Optimized
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-amber-500 font-medium">
                                                                Needs Meta
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleEdit(post)}
                                                                className="h-8 w-8 p-0"
                                                            >
                                                                <Edit className="w-4 h-4 text-foreground" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => post.id && handleDelete(post.id)}
                                                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Editor Modal */}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-xl flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-primary" />
                                {editingId ? 'Edit Article & SEO' : 'New Content Guide'}
                            </DialogTitle>
                            <DialogDescription>
                                Create high-ranking articles with auto-formatted SEO tags, schema, and embedded products.
                            </DialogDescription>
                        </DialogHeader>

                        <Tabs defaultValue="content" className="w-full mt-2">
                            <TabsList className="grid grid-cols-3 mb-6">
                                <TabsTrigger value="content">Article Content</TabsTrigger>
                                <TabsTrigger value="seo">SEO & Google SERP Preview</TabsTrigger>
                                <TabsTrigger value="products">Linked Products</TabsTrigger>
                            </TabsList>

                            {/* Tab 1: Content */}
                            <TabsContent value="content" className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Article Title *</Label>
                                    <Input
                                        placeholder="e.g. 7 Tips for Choosing the Best Maternity Loungewear"
                                        value={formState.title}
                                        onChange={(e) => handleTitleChange(e.target.value)}
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>URL Slug</Label>
                                        <Input
                                            placeholder="7-tips-choosing-best-maternity-loungewear"
                                            value={formState.slug}
                                            onChange={(e) => setFormState({ ...formState, slug: e.target.value })}
                                        />
                                        <p className="text-[11px] text-muted-foreground">
                                            Store URL: <code>/blog/{formState.slug || 'your-slug'}</code>
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Category</Label>
                                        <Input
                                            placeholder="e.g. Maternity, Sleep Care, Fabric Guide"
                                            value={formState.category || ''}
                                            onChange={(e) => setFormState({ ...formState, category: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Author</Label>
                                        <Input
                                            value={formState.author || ''}
                                            onChange={(e) => setFormState({ ...formState, author: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Estimated Read Time (Minutes)</Label>
                                        <Input
                                            type="number"
                                            value={formState.readTimeMinutes || 5}
                                            onChange={(e) => setFormState({ ...formState, readTimeMinutes: parseInt(e.target.value) || 5 })}
                                        />
                                    </div>
                                </div>

                                {/* Featured Image */}
                                <div className="space-y-2">
                                    <Label>Featured Article Image</Label>
                                    <div className="flex items-center gap-4">
                                        <Input
                                            placeholder="Image URL or upload a file"
                                            value={formState.featuredImage || ''}
                                            onChange={(e) => setFormState({ ...formState, featuredImage: e.target.value })}
                                            className="flex-1"
                                        />
                                        <label className="cursor-pointer">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleImageUpload}
                                                disabled={isUploadingImage}
                                            />
                                            <Button type="button" variant="outline" className="gap-2" disabled={isUploadingImage} asChild>
                                                <span>
                                                    <Upload className="w-4 h-4" />
                                                    {isUploadingImage ? 'Uploading...' : 'Upload Image'}
                                                </span>
                                            </Button>
                                        </label>
                                    </div>
                                    <Input
                                        placeholder="Image Alt Text (e.g. Soft cotton maternity pyjama set)"
                                        value={formState.imageAlt || ''}
                                        onChange={(e) => setFormState({ ...formState, imageAlt: e.target.value })}
                                        className="text-xs mt-1"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Short Summary / Excerpt</Label>
                                    <Textarea
                                        placeholder="Brief introduction that hooks the reader and is used in listing cards and meta tags..."
                                        rows={2}
                                        value={formState.summary || ''}
                                        onChange={(e) => handleSummaryChange(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Article Body (Visual Rich Text & HTML Editor) *</Label>
                                        <span className="text-[11px] text-muted-foreground">Format text, add headings, and insert pictures</span>
                                    </div>
                                    <RichTextEditor
                                        value={formState.content || ''}
                                        onChange={(html) => setFormState({ ...formState, content: html })}
                                        placeholder="Write your article, add subheadings, format bullet points, and upload illustrations..."
                                        minHeight="280px"
                                    />
                                </div>
                            </TabsContent>

                            {/* Tab 2: SEO & SERP Preview */}
                            <TabsContent value="seo" className="space-y-5">
                                {/* Google SERP Simulation */}
                                <div className="p-4 rounded-xl bg-secondary/30 border border-border">
                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <Globe className="w-3.5 h-3.5 text-blue-500" />
                                        Google Search Snippet Preview
                                    </div>
                                    <div className="bg-card p-4 rounded-lg border border-border/80 space-y-1 shadow-xs">
                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                            <span>{typeof window !== 'undefined' ? window.location.host : 'store.com'}</span>
                                            <span>›</span>
                                            <span>blog</span>
                                            <span>›</span>
                                            <span>{formState.slug || 'article-slug'}</span>
                                        </div>
                                        <div className="text-blue-600 dark:text-blue-400 font-medium text-base hover:underline cursor-pointer">
                                            {formState.metaTitle || formState.title || 'Your Article Title'}
                                        </div>
                                        <div className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                            {formState.metaDescription || formState.summary || 'Write a compelling meta description to encourage Google searchers to click through to your store.'}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label>Meta Title</Label>
                                        <span className={`text-[11px] ${
                                            (formState.metaTitle?.length || 0) > 60 ? 'text-amber-500 font-semibold' : 'text-muted-foreground'
                                        }`}>
                                            {formState.metaTitle?.length || 0} / 60 characters
                                        </span>
                                    </div>
                                    <Input
                                        placeholder="Title as it appears on Google (max ~60 characters)"
                                        value={formState.metaTitle || ''}
                                        onChange={(e) => setFormState({ ...formState, metaTitle: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label>Meta Description</Label>
                                        <span className={`text-[11px] ${
                                            (formState.metaDescription?.length || 0) > 160 ? 'text-amber-500 font-semibold' : 'text-muted-foreground'
                                        }`}>
                                            {formState.metaDescription?.length || 0} / 160 characters
                                        </span>
                                    </div>
                                    <Textarea
                                        placeholder="Summary shown beneath your title in Google search results (120-160 characters recommended)"
                                        rows={3}
                                        value={formState.metaDescription || ''}
                                        onChange={(e) => setFormState({ ...formState, metaDescription: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Keywords / Tags (Comma separated)</Label>
                                    <Input
                                        placeholder="e.g. loungewear Kenya, maternity sleepwear, silk robe, pyjamas Nairobi"
                                        value={formState.tags || ''}
                                        onChange={(e) => setFormState({ ...formState, tags: e.target.value, metaKeywords: e.target.value })}
                                    />
                                </div>
                            </TabsContent>

                            {/* Tab 3: Linked Products */}
                            <TabsContent value="products" className="space-y-4">
                                <div className="p-4 rounded-xl bg-secondary/30 border border-border">
                                    <h4 className="text-sm font-semibold text-foreground mb-1">Feature Products Inside This Article</h4>
                                    <p className="text-xs text-muted-foreground">
                                        Select products mentioned in the article so readers can click and buy directly. Enter comma-separated product IDs or select below:
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label>Linked Product IDs</Label>
                                    <Input
                                        placeholder="e.g. 1, 4, 12"
                                        value={formState.relatedProductIds || ''}
                                        onChange={(e) => setFormState({ ...formState, relatedProductIds: e.target.value })}
                                    />
                                </div>

                                {products.length > 0 && (
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Quick Add From Your Store:</Label>
                                        <div className="max-h-48 overflow-y-auto border border-border rounded-xl divide-y divide-border">
                                            {products.slice(0, 15).map((p) => {
                                                const currentIds = (formState.relatedProductIds || '')
                                                    .split(',')
                                                    .map((s) => s.trim())
                                                    .filter(Boolean);
                                                const isSelected = currentIds.includes(String(p.id));

                                                return (
                                                    <div
                                                        key={p.id}
                                                        onClick={() => {
                                                            let newIds: string[];
                                                            if (isSelected) {
                                                                newIds = currentIds.filter((id) => id !== String(p.id));
                                                            } else {
                                                                newIds = [...currentIds, String(p.id)];
                                                            }
                                                            setFormState({ ...formState, relatedProductIds: newIds.join(', ') });
                                                        }}
                                                        className={`p-2.5 flex items-center justify-between text-xs cursor-pointer hover:bg-secondary/40 transition-colors ${
                                                            isSelected ? 'bg-primary/10 font-medium text-primary' : ''
                                                        }`}
                                                    >
                                                        <span>{p.name} {p.category ? `(${p.category})` : ''}</span>
                                                        <Badge variant={isSelected ? 'default' : 'outline'} className="text-[10px]">
                                                            {isSelected ? 'Linked' : '+ Link'}
                                                        </Badge>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>

                        <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={formState.isPublished}
                                    onCheckedChange={(checked) => setFormState({ ...formState, isPublished: checked })}
                                    id="publish-switch"
                                />
                                <Label htmlFor="publish-switch" className="text-xs font-semibold cursor-pointer">
                                    {formState.isPublished ? 'Published (Visible to Google & Store)' : 'Draft (Saved privately)'}
                                </Label>
                            </div>

                            <DialogFooter className="gap-2">
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSave}>
                                    {editingId ? 'Save Changes' : 'Publish Article'}
                                </Button>
                            </DialogFooter>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
