import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cronograma Enfermeiro Aprovado",
  description:
    "Cronograma de estudos estratégico para enfermeiras conquistarem a aprovação em concursos. Organizado em 24 semanas com teoria, exercícios, revisões e simulados.",
  keywords: [
    "enfermeiro aprovado",
    "cronograma de estudos",
    "concurso enfermagem",
    "estudo enfermeiro",
  ],
  authors: [{ name: "Enfermeiro Aprovado" }],
  robots: "noindex, nofollow", // Conteúdo privado
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Google Fonts — Poppins + Playfair Display */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Playfair+Display:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* Font Awesome */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
