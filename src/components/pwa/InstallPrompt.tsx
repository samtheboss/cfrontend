import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const APP_NAME = "SmartApps POS";
const DISMISS_KEY = "pwa-install-dismissed-at";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // re-offer a week after dismissal

/** The `beforeinstallprompt` event isn't in the DOM lib types yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function recentlyDismissed() {
  try {
    const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return ts > 0 && Date.now() - ts < SNOOZE_MS;
  } catch {
    return false;
  }
}

/**
 * Inline install CTA. Renders nothing until Chrome/Edge fires
 * `beforeinstallprompt`, so it only shows where an install is actually
 * possible. Meant to sit inside the dashboard welcome banner.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* storage blocked - banner just returns next load */
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  if (!visible || !deferred) return null;

  return (
    <div className="mt-2 flex items-center gap-3 rounded-2xl border border-indigo-500/25 bg-indigo-500/10 px-4 py-3 backdrop-blur">
      <img
        src="/icons/icon-192.png"
        alt=""
        className="h-10 w-10 shrink-0 rounded-lg"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">Install {APP_NAME}</p>
        <p className="truncate text-xs text-slate-400">
          Add to your home screen for quick access
        </p>
      </div>
      <button
        type="button"
        onClick={install}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-400"
      >
        <Download className="h-3.5 w-3.5" />
        Install
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
