"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, XCircle } from "lucide-react";

type ToastVariant = "success" | "error";

const styles: Record<ToastVariant, string> = {
  success: "bg-green-500/15 border-green-500/30 text-green-400",
  error:   "bg-red-500/15 border-red-500/30 text-red-400",
};

const icons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle className="size-4 shrink-0" />,
  error:   <XCircle className="size-4 shrink-0" />,
};

type Props = {
  show: boolean;
  message: string;
  variant?: ToastVariant;
};

export function FloatingToast({ show, message, variant = "success" }: Props) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium shadow-xl backdrop-blur-sm ${styles[variant]}`}
        >
          {icons[variant]}
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
