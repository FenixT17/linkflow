/**
 * Limite de links do plano gratuito — fonte única de verdade partilhada
 * entre o client (UX) e o servidor (enforcement autoritativo).
 *
 * O limite real é imposto no proxy /api/appwrite (server-side), que é o
 * único ponto de entrada das escritas do browser. O valor é usado aqui
 * também pelo client para feedback imediato — nunca diverge do servidor.
 */
export const FREE_PLAN_LINK_LIMIT = 3;
