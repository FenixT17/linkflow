/// <reference types="vitest/globals" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import * as Navigation from "next/navigation";
import * as AuthContext from "@/context/AuthContext";
import type { getCurrentSession as GetCurrentSessionFn } from "@/lib/services";
import DashboardLayout from "@/app/dashboard/layout";
import { ThemeProvider } from "@/components/theme-provider";

type Session = Awaited<ReturnType<typeof GetCurrentSessionFn>>;

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}));

vi.mock("@/hooks/use-csrf", () => ({
  initCsrfToken: vi.fn().mockResolvedValue("token"),
  fetchWithCsrf: vi.fn().mockResolvedValue(new Response()),
  getCsrfCookieFromDocument: vi.fn().mockReturnValue("token"),
}));

vi.mock("@/lib/services", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("@/lib/services");
  return {
    ...actual,
    getCurrentSession: vi.fn(),
  };
});

describe("DashboardLayout auth guard", () => {
  const mockUseAuth = vi.spyOn(AuthContext, "useAuth");

  beforeEach(() => {
    vi.spyOn(Navigation, "usePathname").mockReturnValue("/dashboard");
    vi.spyOn(Navigation, "useRouter").mockReturnValue({
      replace: mockReplace,
      push: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    } as unknown as ReturnType<typeof Navigation.useRouter>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading while authentication state is loading", () => {
    mockUseAuth.mockReturnValue({
      account: null,
      isLoading: true,
    } as unknown as ReturnType<typeof AuthContext.useAuth>);

    render(
      <ThemeProvider>
        <DashboardLayout>
          <div data-testid="content">Conteúdo protegido</div>
        </DashboardLayout>
      </ThemeProvider>
    );

    expect(screen.getByText("A carregar...")).toBeInTheDocument();
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
  });

  it("shows loading when user is not authenticated", () => {
    mockUseAuth.mockReturnValue({
      account: null,
      isLoading: false,
    } as unknown as ReturnType<typeof AuthContext.useAuth>);

    render(
      <ThemeProvider>
        <DashboardLayout>
          <div data-testid="content">Conteúdo protegido</div>
        </DashboardLayout>
      </ThemeProvider>
    );

    expect(screen.getByText("A carregar...")).toBeInTheDocument();
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
  });

  it("renders children when user is authenticated with a page", () => {
    mockUseAuth.mockReturnValue({
      account: { displayName: "Ana Silva", email: "ana@example.com" },
      page: { $id: "page123", username: "ana", displayName: "Ana Silva" },
      isLoading: false,
    } as unknown as ReturnType<typeof AuthContext.useAuth>);

    render(
      <ThemeProvider>
        <DashboardLayout>
          <div data-testid="content">Conteúdo protegido</div>
        </DashboardLayout>
      </ThemeProvider>
    );

    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("redirects to /dashboard/create when authenticated without a page", () => {
    mockReplace.mockClear();
    mockUseAuth.mockReturnValue({
      account: { displayName: "Ana Silva", email: "ana@example.com" },
      page: null,
      isLoading: false,
    } as unknown as ReturnType<typeof AuthContext.useAuth>);

    render(
      <ThemeProvider>
        <DashboardLayout>
          <div data-testid="content">Conteúdo protegido</div>
        </DashboardLayout>
      </ThemeProvider>
    );

    expect(mockReplace).toHaveBeenCalledWith("/dashboard/create");
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
  });

  it("does not redirect on /dashboard/create when authenticated without a page", () => {
    mockReplace.mockClear();
    vi.spyOn(Navigation, "usePathname").mockReturnValue("/dashboard/create");
    mockUseAuth.mockReturnValue({
      account: { displayName: "Ana Silva", email: "ana@example.com" },
      page: null,
      isLoading: false,
    } as unknown as ReturnType<typeof AuthContext.useAuth>);

    render(
      <ThemeProvider>
        <DashboardLayout>
          <div data-testid="content">Criar página</div>
        </DashboardLayout>
      </ThemeProvider>
    );

    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("redirects to /dashboard from /dashboard/create when the user already has a page", () => {
    mockReplace.mockClear();
    vi.spyOn(Navigation, "usePathname").mockReturnValue("/dashboard/create");
    mockUseAuth.mockReturnValue({
      account: { displayName: "Ana Silva", email: "ana@example.com" },
      page: { $id: "page123", username: "ana", displayName: "Ana Silva" },
      isLoading: false,
    } as unknown as ReturnType<typeof AuthContext.useAuth>);

    render(
      <ThemeProvider>
        <DashboardLayout>
          <div data-testid="content">Criar página</div>
        </DashboardLayout>
      </ThemeProvider>
    );

    expect(mockReplace).toHaveBeenCalledWith("/dashboard");
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
  });
});

describe("AuthProvider redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function renderAuthProvider(
    pathname: string,
    getCurrentSessionImpl: () => Promise<Session | null>
  ) {
    vi.spyOn(Navigation, "useRouter").mockReturnValue({
      replace: mockReplace,
      push: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    } as unknown as ReturnType<typeof Navigation.useRouter>);
    vi.spyOn(Navigation, "usePathname").mockReturnValue(pathname);

    const { getCurrentSession: getCurrentSessionFn } = await import("@/lib/services");
    vi.mocked(getCurrentSessionFn).mockImplementation(getCurrentSessionImpl as () => ReturnType<typeof GetCurrentSessionFn>);

    const { AuthProvider } = await import("@/context/AuthContext");

    return render(
      <AuthProvider>
        <div data-testid="child">Content</div>
      </AuthProvider>
    );
  }

  it("redirects to /login when on a protected route without session", async () => {
    mockReplace.mockClear();
    await renderAuthProvider("/dashboard", () => Promise.resolve(null));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/login");
    });
  });

  it("does not redirect when not on a protected route", async () => {
    mockReplace.mockClear();
    await renderAuthProvider("/", () => Promise.resolve(null));

    await waitFor(() => {
      expect(screen.getByTestId("child")).toBeInTheDocument();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
