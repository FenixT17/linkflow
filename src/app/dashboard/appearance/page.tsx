"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AppearancePage() {
  const router = useRouter();
  const { page } = useAuth();

  useEffect(() => {
    if (!page) router.replace("/dashboard/create");
  }, [page, router]);

  if (!page) return null;

  return (
    <div className="space-y-6 animate-glass-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white/90">
            Aparência
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Personalize o visual da sua página.
          </p>
        </div>
      </div>
    </div>
  );
}
