"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface FaqItemProps {
  question: string;
  answer: string;
  isOpen?: boolean;
  onToggle: () => void;
}

export function FaqItem({ question, answer, isOpen, onToggle }: FaqItemProps) {
  return (
    <div
      className={[
        "glass-card overflow-hidden transition-all duration-300",
        isOpen ? "glass-strong" : "",
      ].join(" ")}
    >
      <button
        onClick={onToggle}
        className="relative z-[1] flex w-full items-center justify-between px-6 py-5 text-left"
        aria-expanded={isOpen}
      >
        <span className="text-[15px] font-medium text-[var(--foreground)] pr-4">{question}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="shrink-0"
        >
          <ChevronDown className="h-5 w-5 text-[var(--muted-foreground)]" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="relative z-[1] px-6 pb-5 text-sm text-[var(--muted-foreground)] leading-relaxed">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
