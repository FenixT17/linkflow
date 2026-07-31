"use client";

import { useAuth } from "@/context/AuthContext";
import { PublicProfileRenderer } from "@/components/public/profile-renderer";
import { IPhoneMockup } from "@/components/ui/iphone-mockup";
import { Smartphone } from "lucide-react";

export function LivePreview() {
  const { page, links, appearance } = useAuth();

  if (!page) {
    return (
      <div className="flex h-full min-h-[500px] items-center justify-center glass-card p-8">
        <div className="text-center relative z-[1]">
          <Smartphone className="mx-auto h-10 w-10 text-[var(--muted-foreground)]/40 mb-3" />
          <p className="text-sm text-[var(--muted-foreground)]">Crie primeiro uma página</p>
        </div>
      </div>
    );
  }

  const visibleLinks = links.filter((l) => l.visible && l.active);

  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-between relative z-[1]">
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Smartphone className="h-4 w-4" />
          <span>Pré-visualização ao vivo</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 glass-badge-success">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Tempo real
          </span>
        </div>
      </div>
      <IPhoneMockup className="w-[280px] sm:w-[320px]">
        <div className="max-h-[600px] overflow-y-auto">
          <PublicProfileRenderer
            profile={page}
            links={visibleLinks}
            appearance={appearance}
            showActions={false}
            onRecordClick={() => {}}
          />
        </div>
      </IPhoneMockup>
    </div>
  );
}
