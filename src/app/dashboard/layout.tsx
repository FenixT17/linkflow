"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { isLoading, account, page } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isCreateRoute = pathname === "/dashboard/create";

  // Guard centralizado de "primeira página" — aplica-se a TODAS as rotas do
  // dashboard (não só a algumas páginas):
  //  - Utilizador autenticado SEM página: qualquer rota (incluindo /dashboard
  //    acedido diretamente por URL) redireciona para /dashboard/create. O
  //    dashboard não pode ser usado sem criar a página.
  //  - Utilizador COM página: /dashboard/create redireciona para /dashboard
  //    (o formulário "Salvar e continuar" só deve existir para quem ainda não
  //    tem página — colar /create no URL não deve mostrá-lo).
  useEffect(() => {
    if (isLoading || !account) return;
    if (!page && !isCreateRoute) {
      router.replace("/dashboard/create");
    } else if (page && isCreateRoute) {
      router.replace("/dashboard");
    }
  }, [isLoading, account, page, isCreateRoute, router]);

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

  // Enquanto o redirect acima está a correr, evita renderizar o conteúdo
  // errado (flash do dashboard ou do formulário de criação).
  const needsRedirect = (!page && !isCreateRoute) || (page && isCreateRoute);
  if (needsRedirect) {
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
