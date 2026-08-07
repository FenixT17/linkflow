"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { GlassButton } from "@/components/ui/glass-button";
import { useCsrfAction } from "@/components/ui/csrf-form";
import { fetchWithCsrf } from "@/hooks/use-csrf";
import { Save, Globe, Bell, Shield, Trash2, Mail, Lock, Smartphone, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { account, deleteAccount } = useAuth();
  const [name, setName] = useState(account?.displayName || "");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const { verifyCsrf, csrfError } = useCsrfAction();

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "Tem a certeza? Esta ação apaga permanentemente a sua conta, página, links, fotos, visitantes, IPs, analytics, atividades e restantes dados. Não pode ser desfeita."
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError("");
    const result = await deleteAccount();
    if (!result.success) {
      setDeleteError(result.error || "Não foi possível eliminar a conta. Tente novamente.");
    }
    setDeleting(false);
  };

  const handleSave = async () => {
    const csrfOk = await verifyCsrf();
    if (!csrfOk) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetchWithCsrf("/api/users/profile", {
        method: "PATCH",
        body: JSON.stringify({ displayName: name.trim() }),
      });
      if (!res.ok) throw new Error("Profile update failed");
      setMessage("Definições guardadas.");
    } catch {
      setMessage("Erro ao guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-glass-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white/90">Definições</h1>
        <p className="mt-1 text-sm text-white/50">Gerencie a sua conta e preferências.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6">
            <div className="relative z-10 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-white/90">Conta</h2>
                <p className="text-sm text-white/50">Informações pessoais.</p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="settings-name" className="text-sm font-medium text-white/80">Nome</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="O seu nome" className="glass-input w-full pl-10 pr-4 py-2.5 text-sm" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="settings-email" className="text-sm font-medium text-white/80">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <input id="settings-email" value={account?.email || ""} disabled placeholder="O seu email" className="glass-input w-full pl-10 pr-4 py-2.5 text-sm opacity-60" />
                  </div>
                </div>
                {csrfError && <p className="text-sm text-red-400">{csrfError}</p>}
                {message && <p className="text-sm text-emerald-400">{message}</p>}
                <GlassButton
                  type="submit"
                  variant="primary"
                  loading={saving}
                  className="pl-4! drop-shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--background)]/80 ring-1 ring-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_6px_rgba(0,0,0,0.3)]">
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 text-[var(--foreground)] animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5 text-[var(--foreground)]" strokeWidth={2.75} />
                    )}
                  </span>
                  {saving ? "A guardar..." : "Guardar"}
                </GlassButton>
              </form>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="relative z-10 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-white/90">Segurança</h2>
                <p className="text-sm text-white/50">Proteja a sua conta.</p>
              </div>
              <div className="space-y-3">
                <button disabled className="w-full flex items-center gap-3 p-3 rounded-xl glass-card hover:bg-white/[0.04] transition-colors text-left disabled:opacity-50">
                  <Lock className="h-5 w-5 text-white/60" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white/90">Alterar palavra-passe</p>
                    <p className="text-xs text-white/40">Em breve</p>
                  </div>
                </button>
                <button disabled className="w-full flex items-center gap-3 p-3 rounded-xl glass-card hover:bg-white/[0.04] transition-colors text-left disabled:opacity-50">
                  <Shield className="h-5 w-5 text-white/60" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white/90">Autenticação de dois fatores</p>
                    <p className="text-xs text-white/40">Em breve</p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 border-red-500/20">
            <div className="relative z-10 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-red-400">Zona de perigo</h2>
                <p className="text-sm text-white/50">Ações irreversíveis.</p>
              </div>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="w-full flex items-center gap-3 p-3 rounded-xl glass-card hover:bg-red-500/[0.08] transition-colors text-left disabled:opacity-50"
              >
                <Trash2 className="h-5 w-5 text-red-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white/90">{deleting ? "A eliminar..." : "Eliminar conta"}</p>
                  <p className="text-xs text-white/40">Apaga permanentemente todos os seus dados</p>
                </div>
                {deleting && <Loader2 className="h-4 w-4 animate-spin text-red-400" />}
              </button>
              {deleteError && <p className="text-sm text-red-400" role="alert">{deleteError}</p>}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6">
            <div className="relative z-10 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-white/90">Preferências</h2>
                <p className="text-sm text-white/50">Personalize a sua experiência.</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl glass-card">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-white/60" />
                    <div>
                      <p className="text-sm font-medium text-white/90">Idioma</p>
                      <p className="text-xs text-white/40">Português (Portugal)</p>
                    </div>
                  </div>
                  <span className="text-xs text-white/40">Em breve</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl glass-card">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-white/60" />
                    <div>
                      <p className="text-sm font-medium text-white/90">Notificações</p>
                      <p className="text-xs text-white/40">Receba atualizações</p>
                    </div>
                  </div>
                  <span className="text-xs text-white/40">Em breve</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl glass-card">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-white/60" />
                    <div>
                      <p className="text-sm font-medium text-white/90">Sessões</p>
                      <p className="text-xs text-white/40">Gerir dispositivos</p>
                    </div>
                  </div>
                  <span className="text-xs text-white/40">Em breve</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
