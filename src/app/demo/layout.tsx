import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Demonstração — LinkFlow",
  description: "Veja como a sua página LinkFlow pode ficar. Crie a sua página pessoal premium em minutos.",
  path: "/demo",
});

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
