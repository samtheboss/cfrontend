import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileSpreadsheet, Download, Loader2, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useInventory } from '@/contexts/InventoryContext';

export function ImportProductsDialog() {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();
    const { refreshData } = useInventory();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleImport = async () => {
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            await apiFetch('/api/products/import', {
                method: 'POST',
                body: formData,
            });

            toast({
                title: "Import Successful",
                description: "Products and variants have been imported successfully.",
            });

            await refreshData();
            setIsOpen(false);
            setFile(null);
        } catch (error: any) {
            toast({
                title: "Import Failed",
                description: error.message || "An error occurred during import.",
                variant: "destructive",
            });
        } finally {
            setIsUploading(false);
        }
    };

    const downloadTemplate = () => {
        // Basic CSV template as a fallback or instructions
        const headers = "Product Name,Category,Description,SKU,Barcode,Price,Cost,Stock,Attributes,Low Stock Threshold";
        const blob = new Blob([headers], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'product_import_template.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Import Products</DialogTitle>
                    <DialogDescription>
                        Upload an Excel file (.xlsx or .xls) to bulk import products.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="excel-file">Excel File</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="excel-file"
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleFileChange}
                                disabled={isUploading}
                                className="cursor-pointer"
                            />
                        </div>
                        {file && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                                <span>{file.name}</span>
                            </div>
                        )}
                    </div>

                    <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-xs">
                        <p className="font-semibold flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Required Column Names:
                        </p>
                        <ul className="list-disc list-inside grid grid-cols-2 gap-x-4 gap-y-1 opacity-80">
                            <li>Product Name</li>
                            <li>Category</li>
                            <li>Description</li>
                            <li>SKU</li>
                            <li>Barcode</li>
                            <li>Price</li>
                            <li>Cost</li>
                            <li>Stock</li>
                            <li>Attributes (Key:Val;Key:Val)</li>
                            <li>Low Stock Threshold</li>
                        </ul>
                    </div>
                </div>
                <DialogFooter className="sm:justify-between">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-primary hover:text-primary/80"
                        onClick={downloadTemplate}
                    >
                        <Download className="h-4 w-4 mr-2" />
                        CSV Template
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isUploading}>
                            Cancel
                        </Button>
                        <Button onClick={handleImport} disabled={!file || isUploading}>
                            {isUploading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Importing...
                                </>
                            ) : (
                                'Start Import'
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
