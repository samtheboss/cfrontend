import type { RefObject } from 'react';
import { Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  title?: string;
  iframeRef: RefObject<HTMLIFrameElement>;
  onPrint: () => void;
  autoPrintOnLoad?: boolean;
}

/**
 * Reusable PDF preview popup - pair with the usePdfPreview() hook. Render one instance per page
 * (not per document) and drive it via the hook's showPdf(), so every invoice/receipt/statement
 * on that page shares the same dialog instead of each getting its own.
 */
export function PdfPreviewDialog({ open, onOpenChange, url, title = 'Preview', iframeRef, onPrint, autoPrintOnLoad }: PdfPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 w-full bg-muted">
          {url && (
            <iframe
              ref={iframeRef}
              src={url}
              className="w-full h-full border-none"
              title={title}
              onLoad={() => { if (autoPrintOnLoad) onPrint(); }}
            />
          )}
        </div>
        <DialogFooter className="p-4 border-t bg-card flex justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {url && (
            <Button onClick={onPrint}>
              <Receipt className="h-4 w-4 mr-2" />
              Print
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
