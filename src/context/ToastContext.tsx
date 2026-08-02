"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X, AlertTriangle, Info, CircleAlert } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
}

interface ToastContextType {
  /** `title` keeps the existing message-only API; `description` is optional. */
  showToast: (title: string, type?: ToastType, duration?: number, description?: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

const TOAST_STYLES: Record<ToastType, { icon: typeof Check; accent: string }> = {
  success: { icon: Check, accent: "text-emerald-400 bg-emerald-400/12 ring-emerald-400/20" },
  error: { icon: CircleAlert, accent: "text-red-400 bg-red-400/12 ring-red-400/20" },
  warning: { icon: AlertTriangle, accent: "text-amber-300 bg-amber-300/12 ring-amber-300/20" },
  info: { icon: Info, accent: "text-sky-300 bg-sky-300/12 ring-sky-300/20" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (title: string, type: ToastType = "success", duration = 2500, description?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((previous) => [...previous, { id, title, description, type }]);
      window.setTimeout(() => removeToast(id), duration);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-[200] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3 sm:right-6 sm:top-6"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {toasts.map((toast) => {
            const { icon: Icon, accent } = TOAST_STYLES[toast.type];
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, x: 32, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.96, filter: "blur(4px)" }}
                transition={{ type: "spring", stiffness: 420, damping: 38 }}
                className="pointer-events-auto relative overflow-hidden rounded-2xl border border-black/10 bg-white/80 p-4 text-slate-900 shadow-[0_18px_55px_rgba(0,0,0,0.2)] backdrop-blur-2xl dark:border-white/[0.12] dark:bg-[#111318]/80 dark:text-white"
                role={toast.type === "error" ? "alert" : "status"}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ${accent}`}>
                    <Icon className="h-4 w-4" strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold tracking-tight">{toast.title}</p>
                    {toast.description && (
                      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-white/60">{toast.description}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeToast(toast.id)}
                    className="-mr-1 -mt-1 rounded-lg p-1 text-slate-500 transition-colors hover:bg-black/[0.06] hover:text-slate-900 dark:text-white/40 dark:hover:bg-white/[0.08] dark:hover:text-white"
                    aria-label="Fechar notificação"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
