import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Control de Iglesias",
  description:
    "Noticias, calendario de eventos y notificaciones para administradores y usuarios de la iglesia.",
  manifest: "/manifest.webmanifest",
  applicationName: "Control de Iglesias",
};

export const viewport = {
  themeColor: "#0f1f1d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
