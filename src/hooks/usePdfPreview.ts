import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useInventory } from '@/contexts/InventoryContext';

/**
 * Shared PDF preview/print flow used by invoices, receipts, and ledger statements: fetches
 * a PDF from an authenticated API endpoint, previews it in a popup (via <PdfPreviewDialog>),
 * and prints through the local print service if available, falling back to the browser's
 * native print dialog. One instance of this hook + <PdfPreviewDialog> can be reused for every
 * document a page needs to show, instead of each page building its own preview dialog.
 */
export function usePdfPreview() {
  const { settings } = useInventory() || {};
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('Preview');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    return () => {
      if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
    };
  }, [url]);

  const sendToLocalPrinter = useCallback(async (blob: Blob) => {
    const localPrinterName = localStorage.getItem('localPrinterName') || 'Receipt Printer';
    const printResponse = await fetch(`http://localhost:9000/print?printer=${encodeURIComponent(localPrinterName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf' },
      body: blob,
    });
    if (printResponse.ok) {
      toast.success(`Sent to printer via local print service on ${localPrinterName}!`);
      return true;
    }
    return false;
  }, []);

  const handlePrint = useCallback(async () => {
    if (url) {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        if (await sendToLocalPrinter(blob)) return;
      } catch (e) {
        console.warn('Local print service not available for manual print, using browser print');
      }
    }
    if (iframeRef.current) {
      try {
        iframeRef.current.contentWindow?.print();
      } catch (e) {
        console.error('Failed to print iframe directly:', e);
        if (url) window.open(url, '_blank');
      }
    }
  }, [url, sendToLocalPrinter]);

  /**
   * Fetch a PDF from `fetchUrl` (bearer-token authenticated) and show it in the preview dialog.
   * `auto` (defaults to the autoPrintReceipts system setting) attempts a silent send to the local
   * print service before opening the dialog - pass `auto: false` for documents that should always
   * be reviewed first (e.g. a multi-page statement) regardless of that setting.
   */
  const showPdf = useCallback(async (fetchUrl: string, opts?: { title?: string; auto?: boolean }) => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(fetchUrl, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!response.ok) throw new Error('Failed to fetch document');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));

      const shouldAutoPrint = opts?.auto ?? !!settings?.autoPrintReceipts;
      if (shouldAutoPrint) {
        toast.info('Sending to printer...');
        try {
          if (await sendToLocalPrinter(blob)) return;
          console.warn('Local print service failed, falling back to preview...');
        } catch (e) {
          console.warn('Local print service offline, falling back to preview...', e);
        }
      }

      setUrl(prev => {
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
        return blobUrl;
      });
      setTitle(opts?.title || 'Preview');
      setOpen(true);
    } catch (err) {
      console.error('Error loading preview:', err);
      toast.error('Failed to load preview');
      window.open(fetchUrl, '_blank');
    }
  }, [settings, sendToLocalPrinter]);

  return {
    open,
    setOpen,
    url,
    title,
    iframeRef,
    handlePrint,
    showPdf,
    autoPrintOnLoad: !!settings?.autoPrintReceipts,
  };
}
