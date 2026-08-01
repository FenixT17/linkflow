"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { SocialLinkEntry } from "@/lib/types";
import { updateSocialEntries } from "@/lib/services";
import { buildSocialUrl, getSocialPlatforms, searchSocialPlatforms } from "@/lib/social";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { getPlatform } from "@/lib/platforms";
import { PremiumCard } from "@/components/ui/premium-card";
import { GlassButton } from "@/components/ui/glass-button";
import { cn } from "@/lib/utils";
import {
  GripVertical,
  Plus,
  Search,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  ChevronUp,
  ChevronDown,
  Share2,
} from "lucide-react";

interface SocialLinksSectionProps {
  className?: string;
}

function entryKey(entry: SocialLinkEntry): string {
  return `${entry.platform}:${entry.order}`;
}

/** A draft row has no persisted URL yet (user is still typing). */
function isDraft(entry: SocialLinkEntry): boolean {
  return !entry.url;
}

// ── Memoized row (avoids re-rendering every row on each keystroke) ──

interface SocialEntryRowProps {
  entry: SocialLinkEntry;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  dragOver: "top" | "bottom" | null;
  onChange: (index: number, value: string) => void;
  onCommit: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  onToggle: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, key: string) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDragEnd: () => void;
}

const SocialEntryRow = memo(function SocialEntryRow({
  entry,
  index,
  isFirst,
  isLast,
  dragOver,
  onChange,
  onCommit,
  onRemove,
  onToggle,
  onMove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: SocialEntryRowProps) {
  const platform = getPlatform(entry.platform);
  const displayValue = entry.username ?? entry.url.replace(/^mailto:/, "");
  const preview = buildSocialUrl(entry.platform, displayValue);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, entryKey(entry))}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2 transition-all",
        dragOver === "top" && "border-t-2 border-t-emerald-400",
        dragOver === "bottom" && "border-b-2 border-b-emerald-400",
        !entry.active && "opacity-60"
      )}
    >
      <div className="shrink-0 cursor-grab active:cursor-grabbing text-white/30" aria-hidden="true">
        <GripVertical className="h-4 w-4" />
      </div>
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] ring-1 ring-white/[0.06]"
        style={{ color: platform?.color ?? "#fff" }}
      >
        <PlatformIcon platformId={entry.platform} size={16} color={platform?.color ?? "#fff"} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white/80 truncate">
            {platform?.name ?? entry.platform}
          </span>
          {entry.active ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300">
              Ativo
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.08] text-white/50">
              Inativo
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center">
          <input
            value={displayValue}
            onChange={(e) => onChange(index, e.target.value)}
            onBlur={(e) => onCommit(index, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            placeholder={platform?.urlPrefix ? "Nome de utilizador" : "URL completa (https://...)"}
            aria-label={`${platform?.name ?? entry.platform} — nome de utilizador ou URL`}
            className="glass-input w-full sm:max-w-[220px] px-2.5 py-1.5 text-xs"
          />
          {preview.url ? (
            <span className="text-[11px] text-emerald-300/80 truncate" title={preview.url}>
              {preview.url}
            </span>
          ) : (
            <span className="text-[11px] text-amber-300/80 truncate">
              {preview.error ?? "A aguardar..."}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          onClick={() => onMove(index, -1)}
          disabled={isFirst}
          aria-label={`Mover ${platform?.name ?? entry.platform} para cima`}
          className="p-1.5 rounded-lg hover:bg-white/[0.04] text-white/40 hover:text-white/80 disabled:opacity-30"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onMove(index, 1)}
          disabled={isLast}
          aria-label={`Mover ${platform?.name ?? entry.platform} para baixo`}
          className="p-1.5 rounded-lg hover:bg-white/[0.04] text-white/40 hover:text-white/80 disabled:opacity-30"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onToggle(index)}
          aria-label={entry.active ? "Desativar" : "Ativar"}
          aria-pressed={entry.active}
          className="p-1.5 rounded-lg hover:bg-white/[0.04] text-white/50 hover:text-white/80"
        >
          {entry.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
        <button
          onClick={() => onRemove(index)}
          aria-label={`Remover ${platform?.name ?? entry.platform}`}
          className="p-1.5 rounded-lg hover:bg-white/[0.04] text-white/40 hover:text-red-300"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});

// ── Section ──

export function SocialLinksSection({ className }: SocialLinksSectionProps) {
  const { page, pageId, refreshPage } = useAuth();
  const [entries, setEntries] = useState<SocialLinkEntry[]>(() => page?.socialList ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [dragOver, setDragOver] = useState<{ index: number; position: "top" | "bottom" } | null>(null);
  const dragIdRef = useRef<string | null>(null);
  // Platforms with unsaved edits — kept across server syncs so typing is never lost.
  const dirtyRef = useRef<Set<string>>(new Set());
  // Persists are queued so concurrent actions never interleave writes, and the
  // server-sync effect is suspended while a write is in flight.
  const busyRef = useRef(0);
  const persistQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  // Latest entries for stable callbacks (avoids stale closures + races).
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  // Commit local state + keep the ref in sync synchronously (rapid actions).
  const commitEntries = useCallback((next: SocialLinkEntry[]) => {
    entriesRef.current = next;
    setEntries(next);
  }, []);

  // Sync from server while preserving local drafts and in-progress edits.
  // Skipped while a persist is in flight — the optimistic state is authoritative
  // until the queued write drains.
  useEffect(() => {
    if (busyRef.current > 0) return;
    if (!page?.socialList) return;
    const server = page.socialList ?? [];
    const merged = new Map(server.map((e) => [e.platform, e]));
    for (const entry of entriesRef.current) {
      if (isDraft(entry) || dirtyRef.current.has(entry.platform)) {
        merged.set(entry.platform, entry); // local wins while being edited
      }
    }
    commitEntries([...merged.values()].sort((a, b) => a.order - b.order));
  }, [page?.socialList, commitEntries]);

  const showMessage = useCallback((text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    window.setTimeout(() => setMessage(null), 4000);
  }, []);

  /**
   * Persist only valid entries (drafts with empty URL stay local until commit).
   * Server re-normalizes — the client is never trusted. Calls are queued so a
   * burst of toggles/edits resolves in order (full-state writes, last wins).
   */
  const persist = useCallback(
    async (next: SocialLinkEntry[]) => {
      if (!pageId) return;
      const prev = entriesRef.current;
      busyRef.current += 1;
      commitEntries(next);
      setSaving(true);
      const valid = next.filter((e) => e.url);
      const run = async () => {
        try {
          await updateSocialEntries(pageId, valid);
        } catch (error) {
          showMessage(error instanceof Error ? error.message : "Erro ao guardar redes sociais.", "error");
          // Only restore if this is the last queued persist — a newer one may
          // have already saved a newer state.
          if (busyRef.current === 1) {
            commitEntries(prev);
          }
        } finally {
          busyRef.current -= 1;
          setSaving(false);
        }
        // Reconcile context with the server. Swallowed: a failed refresh must
        // NOT roll back a successful write — the optimistic state stays
        // authoritative until the next successful refresh.
        try {
          await refreshPage();
        } catch {
          // ignore
        }
      };
      persistQueueRef.current = persistQueueRef.current.then(run, run);
      return persistQueueRef.current;
    },
    [pageId, refreshPage, showMessage, commitEntries]
  );

  const available = useMemo(() => {
    const taken = new Set(entries.map((e) => e.platform));
    const queryTrimmed = query.trim();
    const all = queryTrimmed ? searchSocialPlatforms(queryTrimmed) : getSocialPlatforms();
    return all.filter((p) => !taken.has(p.id));
  }, [entries, query]);

  const addPlatform = useCallback(
    (platformId: string) => {
      const platform = getPlatform(platformId);
      if (!platform) return;
      // Add as a LOCAL draft — nothing persisted until the user commits a URL.
      const current = entriesRef.current;
      const maxOrder = current.length > 0 ? Math.max(...current.map((e) => e.order)) : -1;
      commitEntries([
        ...current,
        { platform: platformId, url: "", username: "", order: maxOrder + 1, active: true },
      ]);
      setQuery("");
      setPickerOpen(false);
      showMessage(`${platform.name} adicionado. Indique o nome de utilizador.`);
    },
    [commitEntries, showMessage]
  );

  const updateEntry = useCallback(
    (index: number, value: string) => {
      const platform = entriesRef.current[index]?.platform;
      if (platform) dirtyRef.current.add(platform);
      commitEntries(
        entriesRef.current.map((e, i) => (i === index ? { ...e, username: value } : e))
      );
    },
    [commitEntries]
  );

  /** Commit on blur/Enter — builds + persists the URL from username or full URL. */
  const commitEntry = useCallback(
    (index: number, raw: string) => {
      const entry = entriesRef.current[index];
      if (!entry) return;
      const platform = entry.platform;
      const built = buildSocialUrl(platform, raw);
      if (!built.url) {
        showMessage(built.error ?? "URL inválida.", "error");
        return; // keep dirty — the user is still fixing the value
      }
      dirtyRef.current.delete(platform);
      if (built.url === entry.url) return; // nothing changed
      const next = entriesRef.current.map((e, i) =>
        i === index ? { ...e, username: built.username ?? raw.trim(), url: built.url } : e
      );
      persist(next);
      showMessage(`${getPlatform(platform)?.name ?? platform}: URL gerada.`);
    },
    [persist, showMessage]
  );

  const removeEntry = useCallback(
    (index: number) => {
      const next = entriesRef.current.filter((_, i) => i !== index);
      persist(next);
    },
    [persist]
  );

  const toggleActive = useCallback(
    (index: number) => {
      const next = entriesRef.current.map((e, i) =>
        i === index ? { ...e, active: !e.active } : e
      );
      persist(next);
    },
    [persist]
  );

  const moveEntry = useCallback(
    (index: number, direction: -1 | 1) => {
      const current = entriesRef.current;
      const target = index + direction;
      if (target < 0 || target >= current.length) return;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      persist(next.map((e, i) => ({ ...e, order: i })));
    },
    [persist]
  );

  // ── Drag & drop (HTML5, like the Links page) ──
  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, key: string) => {
    dragIdRef.current = key;
    e.dataTransfer.setData("text/plain", key);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const position = e.clientY < rect.top + rect.height / 2 ? "top" : "bottom";
    setDragOver({ index, position });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
      e.preventDefault();
      const draggedKey = dragIdRef.current ?? e.dataTransfer.getData("text/plain");
      setDragOver(null);
      dragIdRef.current = null;
      if (!draggedKey) return;

      const current = entriesRef.current;
      const from = current.findIndex((en) => entryKey(en) === draggedKey);
      if (from === -1) return;
      let to = dropIndex;
      if (from < to) to -= 1;
      if (from === to) return;

      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      persist(next.map((e, i) => ({ ...e, order: i })));
    },
    [persist]
  );

  const handleDragEnd = useCallback(() => {
    setDragOver(null);
    dragIdRef.current = null;
  }, []);

  return (
    <PremiumCard className={cn("p-5", className)} strong>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-white/[0.05] ring-1 ring-white/[0.06]">
            <Share2 className="h-4 w-4 text-white/70" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white/90 tracking-wide">Redes Sociais</h3>
            <p className="text-xs text-white/50 mt-0.5">
              Adicione as suas redes — só precisa do nome de utilizador.
            </p>
          </div>
        </div>
        {saving && <Loader2 className="h-4 w-4 text-white/40 animate-spin" aria-label="A guardar" />}
      </div>

      {message && (
        <div
          role="status"
          className={cn(
            "mb-4 px-3 py-2 rounded-lg text-xs",
            message.type === "error"
              ? "bg-red-500/10 text-red-200 border border-red-500/20"
              : "bg-emerald-500/10 text-emerald-200 border border-emerald-500/20"
          )}
        >
          {message.text}
        </div>
      )}

      {entries.length === 0 && (
        <p className="text-xs text-white/40 mb-4">
          Nenhuma rede social adicionada. Comece por escolher uma plataforma.
        </p>
      )}

      <div className="space-y-2">
        {entries.map((entry, index) => (
          <SocialEntryRow
            key={entryKey(entry)}
            entry={entry}
            index={index}
            isFirst={index === 0}
            isLast={index === entries.length - 1}
            dragOver={dragOver?.index === index ? dragOver.position : null}
            onChange={updateEntry}
            onCommit={commitEntry}
            onRemove={removeEntry}
            onToggle={toggleActive}
            onMove={moveEntry}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>

      {pickerOpen ? (
        <div className="mt-4 space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar plataforma..."
                aria-label="Pesquisar plataforma"
                autoFocus
                className="glass-input w-full pl-8 pr-3 py-2 text-xs"
              />
            </div>
            <button
              onClick={() => {
                setPickerOpen(false);
                setQuery("");
              }}
              aria-label="Fechar seletor de plataformas"
              className="p-2 rounded-lg hover:bg-white/[0.04] text-white/40 hover:text-white/80"
            >
              Fechar
            </button>
          </div>
          {available.length === 0 ? (
            <p className="text-xs text-white/40 py-4 text-center">
              Sem resultados. Já adicionou todas as plataformas disponíveis.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 max-h-52 overflow-y-auto pr-1">
              {available.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => addPlatform(platform.id)}
                  className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-white/30 outline-none"
                >
                  <span style={{ color: platform.color ?? "#fff" }} className="shrink-0">
                    <PlatformIcon platformId={platform.id} size={16} color={platform.color ?? "#fff"} />
                  </span>
                  <span className="text-xs text-white/80 truncate">{platform.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <GlassButton
          size="sm"
          className="mt-4"
          onClick={() => {
            setPickerOpen(true);
            setQuery("");
          }}
          aria-haspopup="listbox"
          aria-expanded={pickerOpen}
        >
          <Plus className="h-4 w-4" /> Adicionar rede social
        </GlassButton>
      )}
    </PremiumCard>
  );
}
