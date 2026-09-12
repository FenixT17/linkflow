import type { Metadata } from "next";
import Link from "next/link";
import { siteName } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Privacidade e consentimento — LinkFlow",
  description:
    "O que recolhemos, os nossos compromissos e como funciona o consentimento no LinkFlow.",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-[#08090d] px-5 py-16 text-white/80">
      <article className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl backdrop-blur-xl sm:p-10">
        <Link href="/" className="text-sm text-white/55 transition hover:text-white">← Voltar ao LinkFlow</Link>
        <h1 className="mt-8 text-3xl font-semibold text-white">Privacidade e consentimento</h1>
        <p className="mt-4 leading-relaxed text-white/65">
          Esta página explica, de forma resumida, como o {siteName} trata dados quando uma página
          pública é visitada ou quando uma conta é criada. É também a base do consentimento que
          pedimos ao criar conta.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Os nossos compromissos</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-white/65">
          <li>
            <strong className="text-white/85">Não vendemos os teus dados.</strong> Não cedemos nem
            vendemos dados pessoais a terceiros para fins comerciais.
          </li>
          <li>
            <strong className="text-white/85">Não usamos os teus dados para fins próprios.</strong>{" "}
            Os dados não são utilizados para publicidade, perfilização ou qualquer interesse da
            nossa parte.
          </li>
          <li>
            <strong className="text-white/85">Recolha com um único objetivo.</strong> Tudo o que é
            recolhido é recolhido apenas para melhorar a segurança da plataforma e a experiência
            dos utilizadores.
          </li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold text-white">O que recolhemos</h2>

        <h3 className="mt-5 text-base font-semibold text-white/90">Dados de utilização</h3>
        <p className="mt-2 leading-relaxed text-white/65">
          Para disponibilizar analytics ao proprietário de uma página, podemos registar o
          identificador da página, data/hora, país ou cidade aproximada, tipo de dispositivo,
          browser, sistema operativo, referer e um hash não reversível do IP. O IP normal não é
          guardado na coleção principal de analytics.
        </p>

        <h3 className="mt-5 text-base font-semibold text-white/90">Dados adicionais de estudo</h3>
        <p className="mt-2 leading-relaxed text-white/65">
          Dados adicionais, que podem incluir o IP, user-agent, dispositivo e coordenadas
          aproximadas, só são guardados depois de selecionares “Aceitar dados de estudo”. A escolha
          é armazenada neste navegador através de localStorage e de um cookie same-origin. Podes
          recusar — ou retirar o consentimento a qualquer momento, voltando à opção no rodapé da
          página pública — sem impedir a visualização da página.
        </p>

        <h3 className="mt-5 text-base font-semibold text-white/90">Dados de conta</h3>
        <p className="mt-2 leading-relaxed text-white/65">
          Para criar e manter a conta, tratamos email, nome, estado da sessão, conteúdo da página,
          links, imagens e preferências. As credenciais de sessão da aplicação são guardadas em
          cookie HttpOnly e os dados server-only não são expostos pelo browser.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Consentimento</h2>
        <p className="mt-3 leading-relaxed text-white/65">
          Ao criares conta confirmas que leste e aceitas esta política e o tratamento de dados aqui
          descrito, com a finalidade de segurança e melhoria da experiência. Sem esse consentimento
          não é possível criar conta.
        </p>
        <p className="mt-3 leading-relaxed text-white/65">
          A recolha de dados adicionais para estudos é <strong className="text-white/85">opcional</strong>{" "}
          e exige uma escolha explícita no rodapé da página pública. Recusar não afeta a
          visualização da página nem o funcionamento da tua conta.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Fornecedores</h2>
        <p className="mt-3 leading-relaxed text-white/65">
          O serviço utiliza Appwrite para autenticação, base de dados e armazenamento, Cloudflare
          para infraestrutura e Upstash para rate limiting. Alguns pedidos de geolocalização podem
          utilizar serviços externos de GeoIP quando os cabeçalhos da infraestrutura não estão
          disponíveis.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Retenção e direitos</h2>
        <p className="mt-3 leading-relaxed text-white/65">
          Os dados devem ser mantidos apenas pelo tempo necessário para a finalidade descrita. Podes
          pedir acesso, correção ou eliminação dos teus dados através da eliminação de conta ou dos
          canais oficiais do serviço. Antes de lançar o produto comercialmente, a entidade
          responsável, contacto, prazos de retenção e base legal devem ser preenchidos nesta
          política.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Contacto</h2>
        <p className="mt-3 leading-relaxed text-white/65">
          Para questões sobre privacidade ou exercício dos teus direitos, contacta a equipa do
          LinkFlow através dos canais oficiais do serviço.
        </p>
      </article>
    </main>
  );
}
