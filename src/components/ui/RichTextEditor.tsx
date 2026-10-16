import React, { useRef, useState, useEffect } from 'react';
import {
    Bold,
    Italic,
    Underline,
    Strikethrough,
    List,
    ListOrdered,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Link as LinkIcon,
    Image as ImageIcon,
    Heading2,
    Heading3,
    Quote,
    Code,
    Minus,
    RemoveFormatting,
    Eye,
    Upload,
    Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, getBaseUrl } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    minHeight?: string;
}

export function RichTextEditor({
    value,
    onChange,
    placeholder = 'Start writing your article...',
    minHeight = '320px',
}: RichTextEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const [viewMode, setViewMode] = useState<'visual' | 'html'>('visual');
    const [rawHtml, setRawHtml] = useState(value || '');
    const [linkUrl, setLinkUrl] = useState('');
    const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    // Sync external value with editor content
    useEffect(() => {
        if (editorRef.current && viewMode === 'visual') {
            if (editorRef.current.innerHTML !== value) {
                editorRef.current.innerHTML = value || '';
            }
        }
        setRawHtml(value || '');
    }, [value, viewMode]);

    const handleInput = () => {
        if (editorRef.current) {
            const html = editorRef.current.innerHTML;
            setRawHtml(html);
            onChange(html);
        }
    };

    const execCmd = (command: string, arg: string | undefined = undefined) => {
        if (viewMode !== 'visual') return;
        document.execCommand(command, false, arg);
        if (editorRef.current) {
            editorRef.current.focus();
            handleInput();
        }
    };

    const handleApplyLink = () => {
        if (!linkUrl.trim()) return;
        let formattedUrl = linkUrl.trim();
        if (!/^https?:\/\//i.test(formattedUrl) && !formattedUrl.startsWith('/')) {
            formattedUrl = 'https://' + formattedUrl;
        }
        execCmd('createLink', formattedUrl);
        setLinkUrl('');
        setIsLinkPopoverOpen(false);
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
            const fullUrl = data.url.startsWith('http') ? data.url : `${getBaseUrl()}${data.url}`;

            // Insert image element
            execCmd(
                'insertHTML',
                `<figure class="my-6"><img src="${fullUrl}" alt="Article Illustration" class="rounded-2xl max-w-full mx-auto shadow-sm" /><figcaption class="text-xs text-center text-muted-foreground mt-2">Product & Styling Photo</figcaption></figure>`
            );

            toast({
                title: 'Image inserted',
                description: 'Image uploaded and inserted into article.',
            });
        } catch (error) {
            toast({
                title: 'Upload failed',
                description: 'Failed to upload inline image.',
                variant: 'destructive',
            });
        } finally {
            setIsUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleHtmlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setRawHtml(val);
        onChange(val);
    };

    // Word count calculation
    const wordCount = rawHtml
        .replace(/<[^>]*>/g, ' ')
        .split(/\s+/)
        .filter(Boolean).length;

    const readTime = Math.max(1, Math.ceil(wordCount / 200));

    return (
        <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-xs flex flex-col">
            {/* Toolbar */}
            <div className="p-2 border-b border-border bg-secondary/30 flex flex-wrap items-center justify-between gap-1 select-none">
                <div className="flex flex-wrap items-center gap-1">
                    {/* Headings */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs font-semibold"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            execCmd('formatBlock', '<h2>');
                        }}
                        title="Heading 2"
                    >
                        <Heading2 className="w-4 h-4 mr-0.5" />
                        H2
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs font-semibold"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            execCmd('formatBlock', '<h3>');
                        }}
                        title="Heading 3"
                    >
                        <Heading3 className="w-4 h-4 mr-0.5" />
                        H3
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            execCmd('formatBlock', '<p>');
                        }}
                        title="Normal Paragraph"
                    >
                        Normal
                    </Button>

                    <div className="h-4 w-[1px] bg-border mx-1" />

                    {/* Basic Styling */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            execCmd('bold');
                        }}
                        title="Bold (Ctrl+B)"
                    >
                        <Bold className="w-4 h-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            execCmd('italic');
                        }}
                        title="Italic (Ctrl+I)"
                    >
                        <Italic className="w-4 h-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            execCmd('underline');
                        }}
                        title="Underline (Ctrl+U)"
                    >
                        <Underline className="w-4 h-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            execCmd('strikeThrough');
                        }}
                        title="Strikethrough"
                    >
                        <Strikethrough className="w-4 h-4" />
                    </Button>

                    <div className="h-4 w-[1px] bg-border mx-1" />

                    {/* Lists */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            execCmd('insertUnorderedList');
                        }}
                        title="Bullet List"
                    >
                        <List className="w-4 h-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            execCmd('insertOrderedList');
                        }}
                        title="Numbered List"
                    >
                        <ListOrdered className="w-4 h-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            execCmd('formatBlock', '<blockquote>');
                        }}
                        title="Quote"
                    >
                        <Quote className="w-4 h-4" />
                    </Button>

                    <div className="h-4 w-[1px] bg-border mx-1" />

                    {/* Alignment */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            execCmd('justifyLeft');
                        }}
                        title="Align Left"
                    >
                        <AlignLeft className="w-4 h-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            execCmd('justifyCenter');
                        }}
                        title="Align Center"
                    >
                        <AlignCenter className="w-4 h-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            execCmd('justifyRight');
                        }}
                        title="Align Right"
                    >
                        <AlignRight className="w-4 h-4" />
                    </Button>

                    <div className="h-4 w-[1px] bg-border mx-1" />

                    {/* Link Insertion */}
                    <Popover open={isLinkPopoverOpen} onOpenChange={setIsLinkPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Insert Link"
                            >
                                <LinkIcon className="w-4 h-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-3" align="start">
                            <div className="space-y-2">
                                <span className="text-xs font-semibold">Insert Web Link</span>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="https://example.com or /products"
                                        value={linkUrl}
                                        onChange={(e) => setLinkUrl(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleApplyLink();
                                            }
                                        }}
                                        className="h-8 text-xs"
                                    />
                                    <Button size="sm" className="h-8 px-2 text-xs" onClick={handleApplyLink}>
                                        <Check className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Inline Image Upload */}
                    <label className="cursor-pointer">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageUpload}
                            disabled={isUploadingImage}
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={isUploadingImage}
                            asChild
                            title="Upload and insert picture"
                        >
                            <span>
                                <ImageIcon className="w-4 h-4" />
                            </span>
                        </Button>
                    </label>

                    {/* Horizontal Divider */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            execCmd('insertHorizontalRule');
                        }}
                        title="Divider Line"
                    >
                        <Minus className="w-4 h-4" />
                    </Button>

                    {/* Clear Formatting */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            execCmd('removeFormat');
                        }}
                        title="Remove Formatting"
                    >
                        <RemoveFormatting className="w-4 h-4" />
                    </Button>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-background">
                    <button
                        type="button"
                        onClick={() => setViewMode('visual')}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                            viewMode === 'visual'
                                ? 'bg-primary text-primary-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Eye className="w-3.5 h-3.5" />
                        Visual Editor
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('html')}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                            viewMode === 'html'
                                ? 'bg-primary text-primary-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Code className="w-3.5 h-3.5" />
                        HTML Code
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="relative flex-1">
                {viewMode === 'visual' ? (
                    <div
                        ref={editorRef}
                        contentEditable
                        onInput={handleInput}
                        className="p-4 sm:p-6 outline-none prose prose-slate dark:prose-invert max-w-none text-foreground text-sm sm:text-base leading-relaxed overflow-y-auto"
                        style={{ minHeight }}
                        data-placeholder={placeholder}
                    />
                ) : (
                    <textarea
                        value={rawHtml}
                        onChange={handleHtmlChange}
                        className="w-full p-4 font-mono text-xs bg-slate-950 text-emerald-400 outline-none resize-y"
                        style={{ minHeight }}
                        placeholder="<p>Write your raw HTML here...</p>"
                    />
                )}
            </div>

            {/* Bottom Footer Stats */}
            <div className="px-4 py-2 border-t border-border bg-secondary/15 flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                    <span><strong>{wordCount}</strong> words</span>
                    <span>•</span>
                    <span>~<strong>{readTime}</strong> min read</span>
                </div>
                <div className="text-[11px] opacity-70">
                    {viewMode === 'visual' ? 'WYSIWYG Mode (Formatting directly applies)' : 'Raw HTML Editor Mode'}
                </div>
            </div>
        </div>
    );
}
