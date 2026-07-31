import { useAuth } from "@/context/AuthContext";

export function useLinks() {
  const { links, setLinks } = useAuth();
  return { links, setLinks };
}
