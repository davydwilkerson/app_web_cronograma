import type { NextConfig } from "next";

const securityHeaders = [
  // Previne clickjacking — ninguém pode embutir seu app em iframe
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  // Previne MIME-type sniffing
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // XSS Protection
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  // Referrer Policy
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  // HSTS — força HTTPS
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Permissions Policy — desabilita APIs desnecessárias
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
  },
  // Content Security Policy
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Scripts: self + google + youtube + cdn
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://www.youtube.com https://www.google.com https://apis.google.com https://accounts.google.com",
      // Styles: self + google fonts + fontawesome
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
      // Fonts: self + google fonts + fontawesome
      "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:",
      // Images: self + google avatars + placeholder
      "img-src 'self' data: blob: https://*.googleusercontent.com https://via.placeholder.com https://lh3.googleusercontent.com",
      // Connect: self + google
      "connect-src 'self' https://accounts.google.com https://www.googleapis.com",
      // Frames: youtube + google auth
      "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://accounts.google.com",
      // Media: self + youtube
      "media-src 'self' https://www.youtube.com",
      // Object: none
      "object-src 'none'",
      // Base URI
      "base-uri 'self'",
      // Form action
      "form-action 'self' https://accounts.google.com",
      // Frame ancestors — ninguém pode embutir seu site
      "frame-ancestors 'none'",
    ].join("; "),
  },
  // Não cachear páginas protegidas
  {
    key: "Cache-Control",
    value: "no-store, no-cache, must-revalidate, proxy-revalidate",
  },
  {
    key: "Pragma",
    value: "no-cache",
  },
];

const nextConfig: NextConfig = {
  // Permite trocar diretório de build para evitar lock local (ex.: OneDrive)
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // Habilita React Strict Mode
  reactStrictMode: true,

  // Desabilita header X-Powered-By para não expor que usa Next.js
  poweredByHeader: false,

  // Security headers em todas as rotas
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // Redirect da raiz para login
  async redirects() {
    return [
      {
        source: "/",
        destination: "/login",
        permanent: false,
      },
    ];
  },

  // Configurações de imagens
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "via.placeholder.com",
      },
    ],
  },
};

export default nextConfig;
