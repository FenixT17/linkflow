"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { useAuth } from "@/context/AuthContext";
import { CsrfForm } from "@/components/ui/csrf-form";
import { sanitizeDisplayName, sanitizeUsername, sanitizeBio } from "@/lib/sanitize";
import { siteUrl } from "@/lib/seo";
import { Sparkles, Loader2 } from "lucide-react";

export default function CreatePage() {
  const router = useRouter();
  const { account, page, createPage } = useAuth();
  const [username, setUsername] = useState(page?.username ?? account?.displayName?.toLowerCase().replace(/\s+/g, "") ?? "");
  const [displayName, setDisplayName] = useState(page?.displayName ?? account?.displayName ?? "");
  const [bio, setBio] = useState(page?.bio ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const cleanUsername = sanitizeUsername(username);
    const cleanDisplayName = sanitizeDisplayName(displayName);
    const cleanBio = sanitizeBio(bio);
    if (!cleanUsername || !cleanDisplayName) {
      setError("Nome de utilizador e nome público são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      await createPage({ username: cleanUsername, displayName: cleanDisplayName, bio: cleanBio });
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao criar página.");
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-120px)] items-center justify-center py-8">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl glass">
            <Sparkles className="h-6 w-6 text-[var(--foreground)] relative z-[1]" />
          </div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)] tracking-tight">
            Criar a primeira página
          </h1>
          <p className="mt-2 text-[var(--muted-foreground)]">
            Escolha o seu nome de utilizador e personalize a sua página.
          </p>
        </div>
        <GlassCard className="p-6">
          <div className="relative z-[1]">
            <CsrfForm onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium text-[var(--foreground)]">
                  Nome de utilizador
                </label>
                <div className="flex items-center rounded-[var(--glass-radius)] glass-input px-4 py-2.5 text-sm">
                  <span className="text-[var(--muted-foreground)]">{siteUrl.replace(/^https?:\/\//, "")}/@</span>
                  <input id="username" value={username} onChange={(e) => setUsername(e.target.value)}
                    placeholder="alex"
                    className="ml-1 min-w-0 flex-1 bg-transparent outline-none text-[var(--foreground)] placeholder:text-white/30" />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="displayName" className="text-sm font-medium text-[var(--foreground)]">
                  Nome público
                </label>
                <input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex Creator"
                  className="glass-input w-full px-4 py-2.5 text-sm" />
              </div>
              <div className="space-y-2">
                <label htmlFor="bio" className="text-sm font-medium text-[var(--foreground)]">
                  Bio
                </label>
                <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)}
                  placeholder="Uma breve descrição sobre si..." rows={3}
                  className="glass-input w-full px-4 py-2.5 text-sm resize-none" />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                <GlassButton type="button" className="w-full sm:flex-1" onClick={() => router.push("/dashboard")}>
                  Cancelar
                </GlassButton>
                <GlassButton
                  type="submit"
                  variant="primary"
                  className="w-full sm:flex-1 pl-4! drop-shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
                  loading={saving}
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--background)]/80 ring-1 ring-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_6px_rgba(0,0,0,0.3)]">
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 text-[var(--foreground)] animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 text-[var(--foreground)]" strokeWidth={2.75} />
                    )}
                  </span>
                  {saving ? "A guardar..." : "Salvar e continuar"}
                </GlassButton>
              </div>
            </CsrfForm>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
