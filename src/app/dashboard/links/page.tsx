"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { LinkItem } from "@/lib/types";
import { createLink, updateLink, deleteLink as deleteLinkService } from "@/lib/services";
import { GlassButton } from "@/components/ui/glass-button";
import { PremiumCard } from "@/components/ui/premium-card";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { getPlatform } from "@/lib/platforms";
import { useCsrfAction } from "@/components/ui/csrf-form";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  GripVertical,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  X,
  Check,
  MoreHorizontal,
  Link2,
  AlertCircle,
  QrCode,
  ArrowUpDown,
} from "lucide-react";

const FREE_LINK_LIMIT = 3;

type Filter = "all" | "active" | "hidden" | "inactive" | "scheduled";
type SortBy = "manual" | "title" | "clicks" | "date";

function buildUrl(raw: string, platformId?: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^(https?:|mailto:|tel:|sms:)/i.test(trimmed)) return trimmed;
  const platform = getPlatform(platformId || "");
  if (platform?.urlPrefix) return `${platform.urlPrefix}${trimmed}`;
  if (/^[a-z0-9-]+\.[a-z0-9-.]+/i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function formatClicks(count: number) {
  if (count === 0) return "0 cliques";
  if (count === 1) return "1 clique";
  return `${count} cliques`;
}

function useQRCodeUrl(url: string, size = 160): string {
  const encoded = encodeURIComponent(url);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`;
}

function LinkBadge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "warning" | "danger" }) {
  const variants = {
    default: "bg-white/[0.08] text-white/60",
    warning: "bg-amber-500/10 text-amber-300",
    danger: "bg-red-500/10 text-red-300",
  };
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", variants[variant])}>
      {children}
    </span>
  );
}

function LinkQRModal({
  link,
  onClose,
}: {
  link: LinkItem;
  onClose: () => void;
}) {
  const qrUrl = useQRCodeUrl(link.url, 240);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-${sanitizeFileName(link.title)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-sm p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white/90 mb-1">QR Code</h3>
        <p className="text-sm text-white/50 mb-4 truncate">{link.title}</p>
        <div className="flex justify-center mb-4">
          <Image
            src={qrUrl}
            alt={`QR code for ${link.title}`}
            width={240}
            height={240}
            className="rounded-xl"
          />
        </div>
        <div className="flex gap-2">
          <GlassButton className="flex-1" size="sm" onClick={onClose}>
            Fechar
          </GlassButton>
          <GlassButton
            variant="primary"
            className="flex-1"
            size="sm"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? "A descarregar..." : "Descarregar"}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}

function LinkEditor({
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  draft: Partial<LinkItem>;
  onChange: (patch: Partial<LinkItem>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="flex-1 min-w-0 p-2 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/60">Título</label>
          <input
            value={draft.title || ""}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Ex: O meu site"
            className="glass-input w-full px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/60">URL</label>
          <input
            value={draft.url || ""}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://exemplo.com"
            className="glass-input w-full px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <GlassButton variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          <X className="h-4 w-4" /> Cancelar
        </GlassButton>
        <GlassButton size="sm" onClick={onSave} disabled={saving}>
          <Check className="h-4 w-4" /> {saving ? "A guardar..." : "Guardar"}
        </GlassButton>
      </div>
    </div>
  );
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-z0-9_\-\s]/gi, "_").slice(0, 50);
}

function LinkCard({
  link,
  index,
  dragOver,
  dragOverPosition,
  canDrag,
  onEdit,
  editing,
  saving,
  onSave,
  onCancel,
  onToggle,
  onDuplicate,
  onDelete,
  onCopy,
  onQr,
  onDragStart,
  onDragOver,
  onDrop,
  onDragLeave,
}: {
  link: LinkItem;
  index: number;
  dragOver: boolean;
  dragOverPosition: "top" | "bottom" | null;
  canDrag: boolean;
  onEdit: () => void;
  editing: boolean;
  saving: boolean;
  onSave: (draft: Partial<LinkItem>) => void;
  onCancel: () => void;
  onToggle: (field: "active" | "visible") => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onQr: () => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
}) {
  const [draft, setDraft] = useState<Partial<LinkItem>>(link);
  const platform = getPlatform(link.icon || "");
  const isInactive = !link.active;
  const isHidden = !link.visible;

  return (
    <div
      draggable={!editing && canDrag}
      data-index={index}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      className={cn(
        "relative group rounded-[var(--glass-radius)] border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl transition-all duration-200",
        dragOver && "border-white/20 scale-[1.01]",
        isInactive && "opacity-60",
        !editing && canDrag && "cursor-grab active:cursor-grabbing hover:border-white/[0.12]",
        !editing && !canDrag && "cursor-default"
      )}
    >
      {dragOverPosition && (
        <div
          className={cn(
            "absolute left-0 right-0 h-0.5 bg-emerald-400 z-20",
            dragOverPosition === "top" ? "top-0" : "bottom-0"
          )}
        />
      )}
      <div className="relative z-10 flex items-start gap-3 p-3">
        {!editing && (
          <div
            className={cn(
              "pt-1 text-white/30",
              canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed opacity-50"
            )}
            aria-label={canDrag ? "Arrastar" : "Ordenação indisponível com filtro/ordenação ativa"}
          >
            <GripVertical className="h-5 w-5" />
          </div>
        )}
        {editing ? (
          <LinkEditor
            draft={draft}
            onChange={setDraft}
            saving={saving}
            onSave={() => onSave(draft)}
            onCancel={onCancel}
          />
        ) : (
          <>
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] ring-1 ring-white/[0.06]"
              style={{ color: platform?.color || "#fff" }}
            >
              <PlatformIcon platformId={link.icon || "website"} size={20} color={platform?.color || "#fff"} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-medium text-white/90 truncate">{link.title}</h3>
                {isHidden && <LinkBadge>Oculto</LinkBadge>}
                {isInactive && <LinkBadge variant="danger">Inativo</LinkBadge>}
                {link.scheduledFor && <LinkBadge variant="warning">Agendado</LinkBadge>}
              </div>
              <p className="text-xs text-white/40 truncate">{link.url}</p>
              <p className="text-xs text-white/30 mt-1">{formatClicks(link.clicks)}</p>
            </div>
            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onToggle("active")}
                className="p-2 rounded-lg hover:bg-white/[0.04] text-white/50 hover:text-white/80"
                aria-label={link.active ? "Desativar" : "Ativar"}
              >
                {link.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
              <button
                onClick={() => onToggle("visible")}
                className="p-2 rounded-lg hover:bg-white/[0.04] text-white/50 hover:text-white/80"
                aria-label={link.visible ? "Ocultar" : "Mostrar"}
              >
                {link.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
              <button
                onClick={onCopy}
                className="p-2 rounded-lg hover:bg-white/[0.04] text-white/50 hover:text-white/80"
                aria-label="Copiar URL"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={onQr}
                className="p-2 rounded-lg hover:bg-white/[0.04] text-white/50 hover:text-white/80"
                aria-label="Ver QR Code"
              >
                <QrCode className="h-4 w-4" />
              </button>
              <button
                onClick={onEdit}
                className="p-2 rounded-lg hover:bg-white/[0.04] text-white/50 hover:text-white/80"
                aria-label="Editar link"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              <button
                onClick={onDuplicate}
                className="p-2 rounded-lg hover:bg-white/[0.04] text-white/50 hover:text-white/80"
                aria-label="Duplicar link"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={onDelete}
                className="p-2 rounded-lg hover:bg-white/[0.04] text-red-400 hover:text-red-300"
                aria-label="Eliminar link"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function LinksPage() {
  const { links, setLinks, account, pageId } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("manual");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"top" | "bottom" | null>(null);
  const [qrLink, setQrLink] = useState<LinkItem | null>(null);
  const { verifyCsrf } = useCsrfAction();

  const isFreePlan = !account || account.plan === "free";
  const linkLimit = isFreePlan ? FREE_LINK_LIMIT : Infinity;
  const canAddLink = links.length < linkLimit;

  const [newLink, setNewLink] = useState<Partial<LinkItem>>({
    title: "",
    url: "",
    type: "link",
    active: true,
    visible: true,
    newTab: true,
    clicks: 0,
  });

  const debouncedSearch = search.trim().toLowerCase();

  const filteredLinks = useMemo(() => {
    let result = [...links];
    if (debouncedSearch) {
      result = result.filter(
        (l) =>
          l.title.toLowerCase().includes(debouncedSearch) ||
          l.url.toLowerCase().includes(debouncedSearch)
      );
    }
    if (filter === "active") result = result.filter((l) => l.active && l.visible);
    if (filter === "hidden") result = result.filter((l) => !l.visible);
    if (filter === "inactive") result = result.filter((l) => !l.active);
    if (filter === "scheduled") result = result.filter((l) => !!l.scheduledFor);

    if (sortBy === "title") {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "clicks") {
      result.sort((a, b) => b.clicks - a.clicks);
    } else if (sortBy === "date") {
      result.sort((a, b) => b.order - a.order);
    } else {
      result.sort((a, b) => a.order - b.order);
    }

    return result;
  }, [links, debouncedSearch, filter, sortBy]);

  const showMessage = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleAdd = async () => {
    if (!pageId) return;
    if (!canAddLink) {
      showMessage("Limite de links do plano Gratuito atingido (máx. 3).", "error");
      return;
    }
    if (!newLink.title?.trim() || !newLink.url?.trim()) return;
    const csrfOk = await verifyCsrf();
    if (!csrfOk) return;

    setSavingId("add");
    try {
      const link: Omit<LinkItem, "id"> = {
        type: "link",
        title: newLink.title.trim(),
        url: buildUrl(newLink.url, newLink.icon || undefined),
        icon: newLink.icon || undefined,
        active: true,
        visible: true,
        newTab: true,
        order: Math.max(...links.map((l) => l.order), -1) + 1,
        clicks: 0,
      };
      const doc = await createLink(pageId, link);
      setLinks((prev) => [...prev, { ...link, id: doc.$id }]);
      setNewLink({ title: "", url: "", type: "link", active: true, visible: true, newTab: true, clicks: 0 });
      setIsAdding(false);
      showMessage("Link adicionado.");
    } catch (err: unknown) {
      showMessage(err instanceof Error ? err.message : "Erro ao adicionar link.", "error");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    const link = links.find((l) => l.id === id);
    if (!link) return;
    setLinks((prev) => prev.filter((l) => l.id !== id));
    try {
      await deleteLinkService(id);
      showMessage("Link eliminado.");
    } catch {
      setLinks((prev) => [...prev, link]);
      showMessage("Erro ao eliminar link.", "error");
    }
  };

  const handleToggle = async (id: string, field: "active" | "visible") => {
    const link = links.find((l) => l.id === id);
    if (!link) return;
    const next = field === "active" ? !link.active : !link.visible;
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: next } : l)));
    try {
      await updateLink(id, { [field]: next });
    } catch {
      setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: link[field] } : l)));
    }
  };

  const handleDuplicate = async (link: LinkItem) => {
    if (!pageId) return;
    if (!canAddLink) {
      showMessage("Limite do plano atingido.", "error");
      return;
    }
    setSavingId(`dup-${link.id}`);
    const newLinkData: Omit<LinkItem, "id"> = {
      ...link,
      title: `${link.title} (cópia)`,
      order: Math.max(...links.map((l) => l.order), -1) + 1,
      clicks: 0,
    };
    try {
      const doc = await createLink(pageId, newLinkData);
      setLinks((prev) => [...prev, { ...newLinkData, id: doc.$id }]);
      showMessage("Link duplicado.");
    } catch {
      showMessage("Erro ao duplicar link.", "error");
    } finally {
      setSavingId(null);
    }
  };

  const handleCopy = async (link: LinkItem) => {
    try {
      await navigator.clipboard.writeText(link.url);
      showMessage("Link copiado para a área de transferência.");
    } catch {
      showMessage("Não foi possível copiar o link.", "error");
    }
  };

  const reorder = (newOrder: LinkItem[]) => {
    const final = newOrder.map((l, i) => ({ ...l, order: i }));
    setLinks(final);
    Promise.all(final.map((l) => updateLink(l.id, { order: l.order }))).catch(() => {
      setLinks(links);
    });
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, linkId: string) => {
    if (!canReorder) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/plain", linkId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    if (!canReorder) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position = e.clientY < midpoint ? "top" : "bottom";
    setDragOverIndex(index);
    setDragOverPosition(position);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropFilteredIndex: number) => {
    e.preventDefault();
    if (!canReorder) return;
    const draggedId = e.dataTransfer.getData("text/plain");
    if (!draggedId) return;

    const draggedIndexInFull = links.findIndex((l) => l.id === draggedId);
    if (draggedIndexInFull === -1) return;

    // Determine target index in full array. We map the filtered drop index
    // to the corresponding item in the full array and insert next to it.
    const targetLink = filteredLinks[dropFilteredIndex];
    if (!targetLink) return;

    const targetIndexInFull = links.findIndex((l) => l.id === targetLink.id);
    if (targetIndexInFull === -1) return;

    setDragOverIndex(null);
    setDragOverPosition(null);

    if (draggedIndexInFull === targetIndexInFull) return;

    const reordered = [...links];
    const [moved] = reordered.splice(draggedIndexInFull, 1);
    reordered.splice(targetIndexInFull, 0, moved);
    reorder(reordered);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
    setDragOverPosition(null);
  };

  const handleInlineSave = async (id: string, draft: Partial<LinkItem>) => {
    if (!draft.title?.trim() || !draft.url?.trim()) return;
    setSavingId(id);
    const link = links.find((l) => l.id === id);
    if (!link) return;
    const patch: Partial<LinkItem> = {
      title: draft.title.trim(),
      url: buildUrl(draft.url, link.icon || undefined),
    };
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    try {
      await updateLink(id, patch);
      showMessage("Link atualizado.");
    } catch {
      setLinks((prev) => prev.map((l) => (l.id === id ? link : l)));
      showMessage("Erro ao atualizar link.", "error");
    } finally {
      setSavingId(null);
      setEditingId(null);
    }
  };

  const filterLabels: Record<Filter, string> = {
    all: "Todos",
    active: "Ativos",
    hidden: "Ocultos",
    inactive: "Inativos",
    scheduled: "Agendados",
  };

  const sortLabels: Record<SortBy, string> = {
    manual: "Ordem manual",
    title: "Título",
    clicks: "Cliques",
    date: "Data",
  };

  const canReorder = !debouncedSearch && filter === "all" && sortBy === "manual";

  return (
    <div className="space-y-6 animate-glass-fade-in">
      <SectionHeader
        title="Links"
        description="Gerencie todos os seus links num só lugar."
      >
        <GlassButton
          variant="primary"
          size="sm"
          onClick={() => setIsAdding(true)}
          disabled={!canAddLink || isAdding}
        >
          <Plus className="h-4 w-4" /> Novo link
        </GlassButton>
      </SectionHeader>

      {isFreePlan && (
        <PremiumCard className="p-4 border-amber-500/20 bg-amber-500/5" strong>
          <div className="flex items-center gap-3 text-sm text-amber-200">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>
              Plano Gratuito: {links.length} de {FREE_LINK_LIMIT} links usados.
              {links.length >= FREE_LINK_LIMIT && " Faça upgrade para adicionar mais."}
            </span>
          </div>
        </PremiumCard>
      )}

      {message && (
        <PremiumCard
          className={cn(
            "p-4 text-sm",
            message.type === "error"
              ? "border-red-500/20 bg-red-500/10 text-red-200"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
          )}
          strong
        >
          {message.text}
        </PremiumCard>
      )}

      <div className="flex flex-col lg:flex-row gap-3">          <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar links..."
            aria-label="Pesquisar links"
            className="glass-input w-full pl-9 pr-4 py-2.5 text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg p-1 bg-white/[0.02] border border-white/[0.06]">
            {(["all", "active", "hidden", "inactive", "scheduled"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  filter === f
                    ? "bg-white/[0.08] text-white"
                    : "text-white/50 hover:text-white/80"
                )}
              >
                {filterLabels[f]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-lg p-1 bg-white/[0.02] border border-white/[0.06]">
            <ArrowUpDown className="h-3.5 w-3.5 text-white/40 ml-2" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="bg-transparent text-xs text-white/80 outline-none py-1.5 pr-2"
            >
              {(["manual", "title", "clicks", "date"] as const).map((s) => (
                <option key={s} value={s} className="bg-[#0a0a0a]">
                  {sortLabels[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isAdding && (
        <PremiumCard className="p-4 space-y-4" strong>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white/90">Novo link</h3>
            <button
              onClick={() => setIsAdding(false)}
              className="text-white/40 hover:text-white/80"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              value={newLink.title || ""}
              onChange={(e) => setNewLink((p) => ({ ...p, title: e.target.value }))}
              placeholder="Título"
              className="glass-input px-3 py-2 text-sm"
            />
            <input
              value={newLink.url || ""}
              onChange={(e) => setNewLink((p) => ({ ...p, url: e.target.value }))}
              placeholder="URL"
              className="glass-input px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end">
            <GlassButton size="sm" onClick={handleAdd} disabled={savingId === "add"}>
              {savingId === "add" ? "A adicionar..." : "Adicionar link"}
            </GlassButton>
          </div>
        </PremiumCard>
      )}

      <div className="space-y-3">
        {filteredLinks.length === 0 && (
          <EmptyState
            icon={Link2}
            title="Nenhum link encontrado"
            description={
              debouncedSearch
                ? "Tente ajustar a pesquisa ou filtros."
                : "Comece por adicionar o seu primeiro link."
            }
          />
        )}

        {filteredLinks.map((link, index) => (
          <LinkCard
            key={link.id}
            link={link}
            index={index}
            dragOver={dragOverIndex === index}
            dragOverPosition={dragOverIndex === index ? dragOverPosition : null}
            canDrag={canReorder}
            editing={editingId === link.id}
            saving={savingId === link.id}
            onEdit={() => setEditingId(link.id)}
            onCancel={() => setEditingId(null)}
            onSave={(draft) => handleInlineSave(link.id, draft)}
            onToggle={(field) => handleToggle(link.id, field)}
            onDuplicate={() => handleDuplicate(link)}
            onDelete={() => handleDelete(link.id)}
            onCopy={() => handleCopy(link)}
            onQr={() => setQrLink(link)}
            onDragStart={(e) => handleDragStart(e, link.id)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragLeave={handleDragLeave}
          />
        ))}
      </div>

      {qrLink && <LinkQRModal link={qrLink} onClose={() => setQrLink(null)} />}
    </div>
  );
}
