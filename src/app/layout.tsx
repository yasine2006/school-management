import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Centre de soutien", template: "%s · Centre de soutien" },
  description: "Plateforme de gestion d'un centre de soutien scolaire : élèves, matières, groupes, présences et paiements.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b1b3b" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
