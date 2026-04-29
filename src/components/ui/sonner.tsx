"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      theme="dark"
      richColors
      closeButton
      toastOptions={{
        duration: 4000,
        style: {
          background: "hsl(22 10% 9%)",
          border: "1px solid hsl(22 8% 16%)",
          color: "hsl(38 15% 90%)",
          borderRadius: "10px",
          fontFamily: "var(--font-roboto, 'Roboto', sans-serif)",
          fontSize: "13px",
        },
      }}
    />
  );
}
