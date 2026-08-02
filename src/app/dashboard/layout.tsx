"use client";

import { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { isLoading, account } = useAuth();

  if (isLoading || !account) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#030303]">
        <div className="flex items-center gap-3 text-white/50">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">A carregar...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#030303] text-white/90">
        <DashboardSidebar />
        <div className="min-h-dvh lg:pl-[var(--sidebar-width,15rem)] transition-all duration-300">
          <main className="min-h-dvh pt-[calc(3.5rem+env(safe-area-inset-top,0px))] lg:pt-0 pb-24 lg:pb-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto py-6 lg:py-8">{children}</div>
          </main>
        </div>
    </div>
  );
}
