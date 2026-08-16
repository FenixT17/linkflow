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
        <p className="mt-4 leading-relaxed text-white/65">
          Esta página explica, de forma resumida, como o {siteName} trata dados quando uma página pública é visitada ou quando uma conta é criada.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Dados de utilização</h2>
        <p className="mt-3 leading-relaxed text-white/65">
          Para disponibilizar analytics ao proprietário de uma página, podemos registar o identificador da página, data/hora, país ou cidade aproximada, tipo de dispositivo, browser, sistema operativo, referer e um hash não reversível do IP. O IP normal não é guardado na coleção principal de analytics.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Dados adicionais de estudo</h2>
        <p className="mt-3 leading-relaxed text-white/65">
          Dados adicionais, que podem incluir o IP, user-agent, dispositivo e coordenadas aproximadas, só são guardados depois de selecionares “Aceitar dados de estudo”. A escolha é armazenada neste navegador através de localStorage e de um cookie same-origin. Podes recusar sem impedir a visualização da página.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Dados de conta</h2>
        <p className="mt-3 leading-relaxed text-white/65">
          Para criar e manter a conta, tratamos email, nome, estado da sessão, conteúdo da página, links, imagens e preferências. As credenciais de sessão da aplicação são guardadas em cookie HttpOnly e os dados server-only não são expostos pelo browser.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Fornecedores</h2>
        <p className="mt-3 leading-relaxed text-white/65">
          O serviço utiliza Appwrite para autenticação, base de dados e armazenamento, Cloudflare para infraestrutura e Upstash para rate limiting. Alguns pedidos de geolocalização podem utilizar serviços externos de GeoIP quando os cabeçalhos da infraestrutura não estão disponíveis.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Retenção e direitos</h2>
        <p className="mt-3 leading-relaxed text-white/65">
          Os dados devem ser mantidos apenas pelo tempo necessário para a finalidade descrita. Podes pedir acesso, correção ou eliminação dos teus dados através da eliminação de conta ou dos canais oficiais do serviço. Antes de lançar o produto comercialmente, a entidade responsável, contacto, prazos de retenção e base legal devem ser preenchidos nesta política.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Contacto</h2>
        <p className="mt-3 leading-relaxed text-white/65">
          Para questões sobre privacidade ou exercício dos teus direitos, contacta a equipa do LinkFlow através dos canais oficiais do serviço.
        </p>
      </article>
    </main>
  );
}
