import type { Metadata } from "next";
import { Fraunces, Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-sora",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  display: "swap",
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "Cronograma Enfermeiro Aprovado",
  description:
    "Cronograma de estudos estrategico para enfermeiras conquistarem a aprovacao em concursos. Organizado em 24 semanas com teoria, exercicios, revisoes e simulados.",
  keywords: [
    "enfermeiro aprovado",
    "cronograma de estudos",
    "concurso enfermagem",
    "estudo enfermeiro",
  ],
  authors: [{ name: "Enfermeiro Aprovado" }],
  robots: "noindex, nofollow",
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
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
          crossOrigin="anonymous"
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('theme');if(t){document.documentElement.setAttribute('data-theme',t)}}catch(e){}",
          }}
        />
      </head>
      <body className={`${sora.variable} ${fraunces.variable}`}>{children}</body>
    </html>
  );
}
