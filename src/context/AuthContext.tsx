"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { Models } from "appwrite";
import {
  ActivityEntry,
  PageProfile,
  UserAccount,
  LinkItem,
  Appearance,
  UserSettings,
  AnalyticsData,
} from "@/lib/types";

import { detectSuspiciousInput } from "@/lib/sanitize";
import { fetchWithCsrf, initCsrfToken, refreshCsrfToken, clearCsrfToken } from "@/hooks/use-csrf";
import { clearEmailHint } from "@/lib/email-hint";
import {
  defaultAppearance,
  defaultSettings,
  emptyAnalytics,
} from "@/lib/defaults";
import {
  loginUser,
  registerUser,
  logoutUser,
  getUserProfile,
  getPageByUserId,
  getLinksByPageId,
  getThemeByPageId,
  getAnalyticsByPageId,
  getRecentActivities,
  logActivity,
  createPage as createPageService,
  updatePage as updatePageService,
  updateTheme as updateThemeService,
  getCurrentSession,
  loginWithGoogle,
  loginWithGitHub,
  checkAndSyncOAuthUser,
  createSecurityLog,
  syncUserGeo,
} from "@/lib/services";

interface AuthContextValue {
  account: UserAccount | null;
  page: PageProfile | null;
  pageId: string | null;
  links: LinkItem[];
  appearance: Appearance;
  settings: UserSettings;
  analytics: AnalyticsData;
  activities: ActivityEntry[];
  refreshActivities: () => Promise<void>;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (
    name: string,
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
  createPage: (profile: Omit<PageProfile, "published">) => Promise<void>;
  updatePage: (patch: Partial<PageProfile>) => Promise<void>;
  refreshPage: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  refreshAnalytics: () => Promise<void>;
  setLinks: (links: LinkItem[] | ((prev: LinkItem[]) => LinkItem[])) => void;
  updateAppearance: (patch: Partial<Appearance>) => void;
  updateSettings: (patch: Partial<UserSettings>) => void;
  recordView: () => void;
  recordClick: (linkId?: string) => void;
  loginWithGoogle: () => void;
  loginWithGitHub: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const APP_PREFIXES = ["linkflow_", "linkflow-", "theme"];

function clearAppStorage() {
  if (typeof window === "undefined") return;

  // Limpa apenas entradas da aplicação em localStorage/sessionStorage.
  [localStorage, sessionStorage].forEach((store) => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key && APP_PREFIXES.some((prefix) => key.toLowerCase().startsWith(prefix.toLowerCase()))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => store.removeItem(key));
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Ocorreu um erro.";
}

/**
 * Traduz erros comuns do Appwrite para mensagens amigáveis em português.
 */
function getFriendlyError(rawError: unknown, context: "register" | "login"): string {
  const msg = getErrorMessage(rawError).toLowerCase();

  // Email já registado
  if (msg.includes("already exists") || msg.includes("already_exist") || msg.includes("user_already_exists")) {
    return "Este email já tem uma conta. Tente entrar ou use outro email.";
  }

  // Credenciais inválidas (login)
  if (context === "login" && (msg.includes("invalid credentials") || msg.includes("invalid_credentials") || msg.includes("unauthorized"))) {
    return "Email ou palavra-passe incorretos.";
  }

  // Password fraca
  if (msg.includes("password") && (msg.includes("weak") || msg.includes("too short") || msg.includes("invalid"))) {
    return "A palavra-passe não cumpre os requisitos de segurança. Use 12+ caracteres, 1 maiúscula, 1 minúscula, 1 número e 1 símbolo.";
  }

  // Rate limit
  if (msg.includes("rate") || msg.includes("too many")) {
    return "Muitas tentativas. Aguarde um momento antes de tentar novamente.";
  }

  // Fallback: passa a mensagem original
  return getErrorMessage(rawError);
}

function isProtectedRoute(pathname: string) {
  return pathname.startsWith("/dashboard");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [accountData, setAccountData] = useState<UserAccount | null>(null);
  const [page, setPage] = useState<PageProfile | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);
  const [links, setLinksState] = useState<LinkItem[]>([]);
  const [appearance, setAppearance] = useState<Appearance>(() => defaultAppearance());
  const [themeId, setThemeId] = useState<string | null>(null);
  const [settings, setSettingsState] = useState<UserSettings>(() => defaultSettings());
  const [analytics, setAnalytics] = useState<AnalyticsData>(() => emptyAnalytics());
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  // Initialize CSRF token on mount
  useEffect(() => {
    initCsrfToken().catch(() => {});
  }, []);

  /** Sincroniza os valores Liquid Glass com as CSS custom properties no DOM */
  const syncGlassCssVars = useCallback((g: Appearance) => {
    if (typeof document === "undefined") return;
    const s = document.documentElement.style;
    if (g.glassOpacity !== undefined) s.setProperty("--glass-opacity-value", `${g.glassOpacity}%`);
    if (g.glassBlur !== undefined) s.setProperty("--glass-blur-value", `${g.glassBlur}px`);
    if (g.glassStrength !== undefined) {
      const strength = g.glassStrength / 100;
      s.setProperty("--glass-strength-value", `${g.glassStrength}%`);
      s.setProperty("--glass-highlight-opacity-value", `${6 * strength}%`);
      s.setProperty("--glass-shadow-intensity-value", `${0.3 * strength}`);
      s.setProperty("--glass-saturation-value", `${1 + 0.2 * strength}`);
      s.setProperty("--glass-reflex-top-value", `rgba(255, 255, 255, ${0.06 * strength})`);
      s.setProperty("--glass-reflex-bottom-value", `rgba(255, 255, 255, ${0.015 * strength})`);
      s.setProperty("--glass-reflex-side-value", `rgba(255, 255, 255, ${0.02 * strength})`);
    }
  }, []);

  // Sync CSS custom properties whenever appearance changes (handles both initial load and updates)
  useEffect(() => {
    syncGlassCssVars(appearance);
  }, [appearance, syncGlassCssVars]);

  const applyScheduledPublish = useCallback(async (pageDoc: PageProfile & { $id: string }) => {
    const now = new Date();
    const schedPublish = pageDoc.scheduledPublishAt ? new Date(pageDoc.scheduledPublishAt) : null;
    const schedUnpublish = pageDoc.scheduledUnpublishAt ? new Date(pageDoc.scheduledUnpublishAt) : null;
    const needsUpdate: Record<string, unknown> = {};

    if (schedPublish && schedPublish <= now && !pageDoc.published) {
      needsUpdate.published = true;
      needsUpdate.scheduledPublishAt = "";
    }
    if (schedUnpublish && schedUnpublish <= now && pageDoc.published) {
      needsUpdate.published = false;
      needsUpdate.scheduledUnpublishAt = "";
    }

    if (Object.keys(needsUpdate).length > 0) {
      try {
        await updatePageService(pageDoc.$id, needsUpdate as unknown as Partial<PageProfile>);
        setPage((prev) => (prev ? { ...prev, ...needsUpdate } : prev));
      } catch (error) {
        console.error("[AuthContext] Failed to apply scheduled publish:", error);
      }
    }
  }, []);

  const loadPageData = useCallback(async (id: string) => {
    const [fetchedLinks, fetchedTheme, fetchedAnalytics] = await Promise.all([
      getLinksByPageId(id),
      getThemeByPageId(id),
      getAnalyticsByPageId(id),
    ]);
    setLinksState(fetchedLinks);
    const { $id: themeDocId, ...safeTheme } = fetchedTheme;
    setThemeId(themeDocId || null);
    setAppearance(safeTheme);
    setAnalytics(fetchedAnalytics ?? emptyAnalytics());
  }, []);

  const loadUserData = useCallback(async (userId: string, sessionFallback?: Models.User<Models.Preferences>) => {
    if (!userId) {
      setAccountData(null);
      setPage(null);
      setPageId(null);
      return;
    }
    try {
      const [profile, pageDoc] = await Promise.all([
        getUserProfile(userId),
        getPageByUserId(userId),
      ]);

      // Se o documento de perfil ainda não estiver indexado (comum após
      // OAuth), usa os dados da própria sessão para não quebrar o login.
      let finalProfile = profile;
      if (!finalProfile && sessionFallback) {
        finalProfile = {
          email: sessionFallback.email || "",
          displayName: sessionFallback.name || "Utilizador",
          createdAt: sessionFallback.$createdAt || new Date().toISOString(),
          plan: "free",
        };
      }

      setAccountData(finalProfile);
      if (pageDoc) {
        const id = pageDoc.$id;
        setPage(pageDoc);
        setPageId(id);
        await applyScheduledPublish(pageDoc);
        await loadPageData(id);
      }
      // Atividades recentes da conta (independentes da página)
      getRecentActivities(15).then(setActivities).catch(() => {});
    } catch (error) {
      console.error("[AuthContext] Failed to load user data:", error);
    }
  }, [loadPageData, applyScheduledPublish]);

  // Initialize auth state on every route so the app knows whether the user
  // is logged in before they reach a protected page. Protected routes that
  // lack a session are redirected to /login.
  useEffect(() => {
    // Só carrega dados uma vez — navegações subsequentes usam o cache
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const controller = new AbortController();
    let mounted = true;

    async function init() {
      try {
        // Após login OAuth, o cookie de sessão pode demorar alguns
        // milissegundos a propagar. Tentamos obter a sessão várias vezes
        // antes de desistir.
        let session = null;
        let lastError: unknown = null;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          if (controller.signal.aborted || !mounted) return;
          try {
            session = await getCurrentSession();
            if (session) break;
          } catch (error) {
            lastError = error;
            // Espera crescente: 250ms, 500ms, 750ms, 1000ms
            if (attempt < 4) {
              await new Promise((resolve) => {
                const id = setTimeout(resolve, 250 * (attempt + 1));
                controller.signal.addEventListener("abort", () => clearTimeout(id), { once: true });
              });
            }
          }
        }

        if (!mounted) return;

        if (!session) {
          if (process.env.NODE_ENV === "development" && lastError) {
            console.warn("[AuthContext] No session found:", lastError);
          }
          // Limpa estado. Só redireciona se estiver numa rota protegida.
          setAccountData(null);
          setPage(null);
          setPageId(null);
          setLinksState([]);
          setAppearance(defaultAppearance());
          setThemeId(null);
          setAnalytics(emptyAnalytics());
          setActivities([]);
          clearAppStorage();
          if (pathname && isProtectedRoute(pathname)) {
            router.replace("/login");
          }
          return;
        }

        // Sincronização OAuth: usa API route server-side para evitar
        // problemas de permissão do client SDK. Falhas não quebram o login.
        // O endpoint verifica o cookie de sessão e deriva o userId server-side.
        await checkAndSyncOAuthUser(session);

        await loadUserData(session.$id, session);
      } catch {
        // No session or Appwrite not configured yet — redirect to login if protected
        if (mounted) {
          setAccountData(null);
          setPage(null);
          setPageId(null);
          setLinksState([]);
          setAppearance(defaultAppearance());
          setThemeId(null);
          setAnalytics(emptyAnalytics());
          setActivities([]);
          clearAppStorage();
          if (pathname && isProtectedRoute(pathname)) {
            router.replace("/login");
          }
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [loadUserData, pathname, router]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      // Detect suspicious input
      const suspicious = detectSuspiciousInput(email);
      if (suspicious.suspicious) {
        createSecurityLog({
          userId: "anonymous",
          eventType: "suspicious_input",
          email,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          metadata: { field: "email", patterns: suspicious.matchedPatterns },
        });
      }

      // Log attempt
      createSecurityLog({
        userId: "anonymous",
        eventType: "login_attempt",
        email,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });

      await loginUser(email, password);
      const session = await getCurrentSession();

      // Registo de atividade: login bem-sucedido
      void logActivity("login");

      // Mitigação de session fixation: renova o token CSRF após login
      refreshCsrfToken().catch(() => {});

      // Log success (anonymous + authenticated)
      createSecurityLog({
        userId: "anonymous",
        eventType: "login_success",
        email,
        userAgent: navigator.userAgent,
        metadata: { authenticatedUserId: session.$id },
      });

      await loadUserData(session.$id, session);
      return { success: true };
    } catch (error: unknown) {
      // Log failure
      createSecurityLog({
        userId: "anonymous",
        eventType: "login_failure",
        email,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        metadata: { error: getErrorMessage(error) },
      });
      return { success: false, error: getFriendlyError(error, "login") };
    }
  }, [loadUserData]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    try {
      // Detect suspicious input
      const emailCheck = detectSuspiciousInput(email);
      const nameCheck = detectSuspiciousInput(name);
      if (emailCheck.suspicious || nameCheck.suspicious) {
        createSecurityLog({
          userId: "anonymous",
          eventType: "suspicious_input",
          email,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          metadata: {
            field: emailCheck.suspicious ? "email" : "name",
            patterns: emailCheck.suspicious ? emailCheck.matchedPatterns : nameCheck.matchedPatterns,
          },
        });
      }

      // Log attempt
      createSecurityLog({
        userId: "anonymous",
        eventType: "register_attempt",
        email,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        metadata: { displayName: name },
      });

      const { account: newAccount, geo } = await registerUser(email, password, name);

      // Registo de atividade: conta criada
      void logActivity("register", { displayName: name });

      // Mitigação de session fixation: renova o token CSRF após registo
      refreshCsrfToken().catch(() => {});

      // Log success (anonymous for security dashboard visibility)
      createSecurityLog({
        userId: "anonymous",
        eventType: "register_success",
        email,
        userAgent: navigator.userAgent,
        metadata: { authenticatedUserId: newAccount.$id },
      });

      setAccountData({
        email,
        displayName: name,
        createdAt: new Date().toISOString(),
        plan: "free",
        country: geo?.country || undefined,
        countryCode: geo?.countryCode || undefined,
        currency: geo?.currency || undefined,
      });

      // Carrega dados da página/ tema / links após registro bem-sucedido.
      await loadUserData(newAccount.$id, {
        $id: newAccount.$id,
        email,
        name,
        $createdAt: new Date().toISOString(),
      } as Models.User<Models.Preferences>);

      return { success: true };
    } catch (error: unknown) {
      // Log failure
      createSecurityLog({
        userId: "anonymous",
        eventType: "register_failure",
        email,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        metadata: { error: getErrorMessage(error), displayName: name },
      });
      return { success: false, error: getFriendlyError(error, "register") };
    }
  }, [loadUserData]);

  const logout = useCallback(async () => {
    try {
      // Registo de atividade ANTES de terminar as sessões (o client SDK
      // precisa da sessão ativa para gravar). Fire-and-forget.
      await logActivity("logout");
      if (accountData?.email) {
        createSecurityLog({
          userId: "anonymous",
          eventType: "logout",
          email: accountData.email,
          userAgent: navigator.userAgent,
        });
      }
      await logoutUser();
      // Limpa o cookie CSRF primeiro no servidor...
      fetch("/api/csrf", { method: "DELETE", credentials: "include" }).catch(() => {});
      // ...depois limpa o token local (memória + cookie do browser)
      clearCsrfToken();
    } finally {
      setAccountData(null);
      setPage(null);
      setPageId(null);
      setLinksState([]);
      setAppearance(defaultAppearance());
      setThemeId(null);
      setAnalytics(emptyAnalytics());
      setActivities([]);
      // Limpa qualquer cache/estado local sensível (inclui o email lembrado)
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("linkflow_session_checked");
      }
      clearEmailHint();
      clearAppStorage();
      // Permite que o efeito de inicialização reexecute após novo login.
      hasLoadedRef.current = false;
      router.replace("/login");
    }
  }, [router, accountData]);

  const deleteAccount = useCallback(async () => {
    try {
      const response = await fetchWithCsrf("/api/users/delete", {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        return { success: false, error: data.error || "Não foi possível eliminar a conta." };
      }

      // The server has already deleted the Appwrite identity and session.
      clearCsrfToken();
      setAccountData(null);
      setPage(null);
      setPageId(null);
      setLinksState([]);
      setAppearance(defaultAppearance());
      setThemeId(null);
      setAnalytics(emptyAnalytics());
      setActivities([]);
      clearEmailHint();
      clearAppStorage();
      hasLoadedRef.current = false;
      router.replace("/login?deleted=1");
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }, [router]);

  const createPage = useCallback(async (profile: Omit<PageProfile, "published">) => {
    const doc = await createPageService(profile);
    const id = doc.$id;
    const newPage: PageProfile = { ...profile, published: false };
    setPage(newPage);
    setPageId(id);
    setAppearance(defaultAppearance());
    setAnalytics(emptyAnalytics());
  }, []);

  const updatePage = useCallback(async (patch: Partial<PageProfile>) => {
    if (!pageId) return;
    await updatePageService(pageId, patch);
    setPage((prev) => (prev ? { ...prev, ...patch } : prev));
  }, [pageId]);

  const refreshPage = useCallback(async () => {
    if (!pageId) return;
    try {
      const session = await getCurrentSession();
      const refreshed = await getPageByUserId(session.$id);
      if (refreshed) {
        setPage(refreshed);
      }
    } catch {
      // Mantém o estado local se a atualização falhar.
    }
  }, [pageId]);

  const refreshAccount = useCallback(async () => {
    try {
      const session = await getCurrentSession();
      const profile = await getUserProfile(session.$id);
      if (profile) setAccountData(profile);
    } catch {
      // silencioso — mantém o estado atual
    }
  }, []);

  // Backfill do país/moeda para contas antigas (criadas antes da moeda
  // localizada): quando o documento users não tem countryCode/currency,
  // recolhe o geo por IP em background e atualiza o estado. Idempotente
  // (syncUserGeo devolve cedo se já sincronizado) — sem loops de refresh.
  useEffect(() => {
    if (!accountData || accountData.countryCode || accountData.currency) return;
    let cancelled = false;
    syncUserGeo()
      .then((geo) => {
        if (cancelled || !geo || !geo.countryCode) return;
        setAccountData((prev) => (prev ? { ...prev, ...geo } : prev));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accountData]);

  const refreshAnalytics = useCallback(async () => {
    if (!pageId) return;
    try {
      const fetched = await getAnalyticsByPageId(pageId);
      setAnalytics(fetched ?? emptyAnalytics());
    } catch (error) {
      console.error("[AuthContext] refreshAnalytics failed:", error);
    }
  }, [pageId]);

  const refreshActivities = useCallback(async () => {
    try {
      const fetched = await getRecentActivities(15);
      setActivities(fetched);
    } catch {
      // silencioso — o cartão fica com os dados anteriores
    }
  }, []);

  const setLinks = useCallback((value: LinkItem[] | ((prev: LinkItem[]) => LinkItem[])) => {
    setLinksState((prev) => (typeof value === "function" ? (value as (prev: LinkItem[]) => LinkItem[])(prev) : value));
  }, []);

  const updateAppearance = useCallback((patch: Partial<Appearance>) => {
    setAppearance((prev) => {
      const next = { ...prev, ...patch };

      // Sync Liquid Glass controls to CSS custom properties in real time
      if (next.glassOpacity !== undefined) {
        document.documentElement.style.setProperty("--glass-opacity-value", `${next.glassOpacity}%`);
      }
      if (next.glassBlur !== undefined) {
        document.documentElement.style.setProperty("--glass-blur-value", `${next.glassBlur}px`);
      }
      if (next.glassStrength !== undefined) {
        const strength = next.glassStrength / 100;
        document.documentElement.style.setProperty("--glass-strength-value", `${next.glassStrength}%`);
        // Glass strength controls multiple visual properties
        document.documentElement.style.setProperty("--glass-highlight-opacity-value", `${6 * strength}%`);
        document.documentElement.style.setProperty("--glass-shadow-intensity-value", `${0.3 * strength}`);
        document.documentElement.style.setProperty("--glass-saturation-value", `${1 + 0.2 * strength}`);
        document.documentElement.style.setProperty("--glass-reflex-top-value", `rgba(255, 255, 255, ${0.06 * strength})`);
        document.documentElement.style.setProperty("--glass-reflex-bottom-value", `rgba(255, 255, 255, ${0.015 * strength})`);
        document.documentElement.style.setProperty("--glass-reflex-side-value", `rgba(255, 255, 255, ${0.02 * strength})`);
      }

      if (themeId) {
        updateThemeService(themeId, next).catch((error) =>
          console.error("[AuthContext] updateAppearance failed:", error)
        );
      }
      return next;
    });
  }, [themeId]);

  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    setSettingsState((prev) => ({ ...prev, ...patch }));
  }, []);

  // /api/view e /api/click são endpoints públicos anónimos (rate-limited por
  // IP) que NÃO usam csrfGuard. Usamos fetch simples de propósito: com o
  // fetchWithCsrf fail-closed (M2), um token CSRF indisponível quebraria o
  // tracking destes endpoints que não exigem CSRF.
  const recordView = useCallback(async () => {
    if (!pageId) return;
    setAnalytics((prev) => ({ ...prev, views: prev.views + 1 }));
    try {
      await fetch("/api/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId }),
      });
    } catch (error) {
      console.error("[AuthContext] recordView failed:", error);
    }
  }, [pageId]);

  const recordClick = useCallback(async (linkId?: string) => {
    if (!pageId) return;
    setAnalytics((prev) => {
      const clicks = prev.clicks + 1;
      const ctr = prev.views > 0 ? Math.round((clicks / prev.views) * 100) : 0;
      return { ...prev, clicks, ctr };
    });
    try {
      await fetch("/api/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, linkId }),
      });
    } catch (error) {
      console.error("[AuthContext] recordClick failed:", error);
    }
  }, [pageId]);

  const value = useMemo(
    () => ({
      account: accountData,
      page,
      pageId,
      links,
      appearance,
      settings,
      analytics,
      activities,
      refreshActivities,
      isLoading,
      login,
      register,
      logout,
      deleteAccount,
      createPage,
      updatePage,
      refreshPage,
      refreshAccount,
      refreshAnalytics,
      setLinks,
      updateAppearance,
      updateSettings,
      recordView,
      recordClick,
      loginWithGoogle,
      loginWithGitHub,
    }),
    [
      accountData,
      page,
      pageId,
      links,
      appearance,
      settings,
      analytics,
      activities,
      refreshActivities,
      isLoading,
      login,
      register,
      logout,
      deleteAccount,
      createPage,
      updatePage,
      refreshPage,
      refreshAccount,
      refreshAnalytics,
      setLinks,
      updateAppearance,
      updateSettings,
      recordView,
      recordClick,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
