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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileSpreadsheet, Download, Loader2, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useInventory } from '@/contexts/InventoryContext';
import { exportProductsToCsv, downloadProductTemplateCsv } from '@/utils/productExportImport';

export function ImportProductsDialog() {
    const [file, setFile] = useState<File | null>(null);
    const [locationId, setLocationId] = useState<string>('');
    const [isUploading, setIsUploading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();
    const { refreshData, locations, products } = useInventory();

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
        if (locationId) {
            formData.append('locationId', locationId);
        }

        try {
            await apiFetch('/api/products/import' + (locationId ? `?locationId=${locationId}` : ''), {
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
            setLocationId('');
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

    const handleExportCurrent = () => {
        const count = exportProductsToCsv(products);
        toast({
            title: "Products Exported",
            description: `Exported ${count} items. You can edit this file and upload it here to re-import.`,
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Import Products & Variants</DialogTitle>
                    <DialogDescription>
                        Upload an Excel file (.xlsx, .xls) or CSV (.csv) to bulk import or update products.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="import-file">Spreadsheet or CSV File</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="import-file"
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                onChange={handleFileChange}
                                disabled={isUploading}
                                className="cursor-pointer"
                            />
                        </div>
                        {file && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                                <span className="font-medium text-foreground">{file.name}</span>
                                <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                            </div>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="stock-location">Stock Location (Optional: updates location stock count)</Label>
                        <Select value={locationId} onValueChange={setLocationId}>
                            <SelectTrigger id="stock-location">
                                <SelectValue placeholder="All / Default main location" />
                            </SelectTrigger>
                            <SelectContent>
                                {locations.map(loc => (
                                    <SelectItem key={loc.id} value={loc.id.toString()}>
                                        {loc.name} {loc.isMain ? '(Main)' : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-xs border">
                        <div className="flex items-center justify-between">
                            <p className="font-semibold flex items-center gap-1.5 text-foreground">
                                <AlertCircle className="h-3.5 w-3.5 text-primary" /> Supported Columns:
                            </p>
                            <span className="text-[11px] text-muted-foreground">Compatible with Excel & CSV</span>
                        </div>
                        <ul className="list-disc list-inside grid grid-cols-2 gap-x-4 gap-y-1 opacity-80">
                            <li>Product Name</li>
                            <li>Category</li>
                            <li>SubCategory (optional)</li>
                            <li>Description</li>
                            <li>SKU</li>
                            <li>Barcode</li>
                            <li>Price (Sell Price)</li>
                            <li>Cost (Buy Price)</li>
                            <li>Stock (Quantity)</li>
                            <li>Attributes (e.g. Size:M;Color:Red)</li>
                            <li>Low Stock Threshold</li>
                        </ul>
                    </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground hover:text-foreground"
                            onClick={downloadProductTemplateCsv}
                        >
                            <Download className="h-3.5 w-3.5 mr-1.5" />
                            Sample Template
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs text-primary hover:text-primary/80"
                            onClick={handleExportCurrent}
                        >
                            <Download className="h-3.5 w-3.5 mr-1.5" />
                            Export Current Catalog
                        </Button>
                    </div>
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
