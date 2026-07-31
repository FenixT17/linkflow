/**
 * LinkFlow — Liquid Glass Design System
 *
 * O LinkFlow utiliza exclusivamente o sistema Liquid Glass.
 * Não existem temas alternativos. A única variação visual
 * é controlada pelos parâmetros de opacidade, blur e intensidade.
 */

/** Classes CSS base do Liquid Glass para a página pública */
export interface LiquidGlassClasses {
  backgroundClass: string;
  cardClass: string;
  linkClass: string;
  linkHoverClass: string;
  linkIconClass: string;
  titleClass: string;
  bioClass: string;
  usernameClass: string;
  buttonClass: string;
  footerClass: string;
}

/**
 * Devolve as classes CSS do Liquid Glass.
 *
 * Ao contrário do sistema antigo com 6 temas, este é o único
 * sistema visual do LinkFlow. As variações de opacidade, blur
 * e intensidade são aplicadas via variáveis CSS (--glass-opacity-value,
 * --glass-blur-value, etc.) e não via classes diferentes.
 */
export function getLiquidGlassClasses(): LiquidGlassClasses {
  return {
    backgroundClass: "bg-[var(--background)]",
    cardClass: "glass-card glass-shadow",
    linkClass: "glass px-5 py-4 text-[var(--foreground)]/90 relative",
    linkHoverClass: "hover:!bg-white/[0.04] hover:border-white/[0.15] hover:text-[var(--foreground)] hover:scale-[1.01] hover:-translate-y-0.5",
    linkIconClass: "text-white/30 group-hover:text-white/70 transition-colors duration-300",
    titleClass: "text-[var(--foreground)]/90",
    bioClass: "text-[var(--muted-foreground)]",
    usernameClass: "text-[var(--muted-foreground)]/70",
    buttonClass: "glass-btn !rounded-full !h-9 !w-9 !p-0 flex items-center justify-center",
    footerClass: "text-[var(--muted-foreground)]/50 hover:text-[var(--muted-foreground)]",
  };
}
