import type { Metadata } from "next";
import Link from "next/link";
import { siteName } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Política de privacidade — LinkFlow",
  description: "Informação sobre privacidade e dados recolhidos pelo LinkFlow.",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-[#08090d] px-5 py-16 text-white/80">
      <article className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl backdrop-blur-xl sm:p-10">
        <Link href="/" className="text-sm text-white/55 transition hover:text-white">← Voltar ao LinkFlow</Link>
        <h1 className="mt-8 text-3xl font-semibold text-white">Política de privacidade</h1>
        <p className="mt-4 leading-relaxed text-white/65">No {siteName}, recolhemos apenas os dados necessários para disponibilizar o serviço e melhorar a experiência.</p>
        <h2 className="mt-8 text-xl font-semibold text-white">Dados de utilização</h2>
        <p className="mt-3 leading-relaxed text-white/65">As visualizações e cliques são usados para apresentar métricas ao proprietário da página. Dados adicionais para estudos, incluindo informação do dispositivo e localização aproximada, só são recolhidos quando aceitas expressamente esse tratamento.</p>
        <h2 className="mt-8 text-xl font-semibold text-white">As tuas escolhas</h2>
        <p className="mt-3 leading-relaxed text-white/65">Podes recusar o consentimento no aviso apresentado nas páginas públicas. O consentimento fica guardado localmente neste navegador e pode ser removido ao limpar os dados do site.</p>
        <h2 className="mt-8 text-xl font-semibold text-white">Contacto</h2>
        <p className="mt-3 leading-relaxed text-white/65">Para questões sobre privacidade ou exercício dos teus direitos, contacta a equipa do LinkFlow através dos canais oficiais do serviço.</p>
      </article>
    </main>
  );
}
