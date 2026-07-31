/// <reference types="vitest/globals" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { DashboardSidebar, nav } from "@/components/dashboard/sidebar";
import * as AuthContext from "@/context/AuthContext";
import * as Navigation from "next/navigation";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/components/ui/logo", () => ({
  Logo: ({ size }: { size: number }) => <svg data-testid="logo" width={size} height={size} />,
}));

vi.mock("@/components/ui/theme-toggle", () => ({
  ThemeToggle: ({ className }: { className?: string }) => <button data-testid="theme-toggle" className={className}>Theme</button>,
}));

describe("DashboardSidebar", () => {
  const mockUseAuth = vi.spyOn(AuthContext, "useAuth");
  const mockUsePathname = vi.spyOn(Navigation, "usePathname");

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      account: { displayName: "Ana Silva", email: "ana@example.com" },
      logout: vi.fn(),
    } as unknown as ReturnType<typeof AuthContext.useAuth>);
    mockUsePathname.mockReturnValue("/dashboard");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders all dashboard navigation links", () => {
    render(<DashboardSidebar />);
    const desktop = screen.getByLabelText("Navegação desktop");
    for (const item of nav) {
      expect(within(desktop).getByText(item.label)).toBeInTheDocument();
    }
  });

  it("links point to the correct routes", () => {
    render(<DashboardSidebar />);
    const desktop = screen.getByLabelText("Navegação desktop");
    for (const item of nav) {
      const link = within(desktop).getByText(item.label).closest("a");
      expect(link).toHaveAttribute("href", item.href);
    }
  });

  it("marks the current route as active", () => {
    mockUsePathname.mockReturnValue("/dashboard/profile");
    render(<DashboardSidebar />);
    const desktop = screen.getByLabelText("Navegação desktop");
    const activeLink = within(desktop).getByText("Perfil").closest("a");
    expect(activeLink?.className).toContain("glass-item-active");
  });

  it("marks parent route active when on nested path", () => {
    mockUsePathname.mockReturnValue("/dashboard/profile/settings");
    render(<DashboardSidebar />);
    const desktop = screen.getByLabelText("Navegação desktop");
    const activeLink = within(desktop).getByText("Perfil").closest("a");
    expect(activeLink?.className).toContain("glass-item-active");
  });

  it("shows user display name and email", () => {
    render(<DashboardSidebar />);
    expect(screen.getByText("Ana Silva")).toBeInTheDocument();
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
  });

  it("calls logout when Sair button is clicked", () => {
    const logout = vi.fn();
    mockUseAuth.mockReturnValue({
      account: { displayName: "Ana Silva", email: "ana@example.com" },
      logout,
    } as unknown as ReturnType<typeof AuthContext.useAuth>);
    render(<DashboardSidebar />);
    fireEvent.click(screen.getByText("Sair"));
    expect(logout).toHaveBeenCalled();
  });

  it("opens mobile menu when trigger is clicked", () => {
    render(<DashboardSidebar />);
    fireEvent.click(screen.getByLabelText("Abrir menu"));
    expect(screen.getByLabelText("Fechar menu")).toBeInTheDocument();
  });

  it("closes mobile menu when close button is clicked", () => {
    render(<DashboardSidebar />);
    fireEvent.click(screen.getByLabelText("Abrir menu"));
    expect(screen.getByLabelText("Fechar menu")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Fechar menu"));
    expect(screen.queryByLabelText("Fechar menu")).not.toBeInTheDocument();
  });
});
