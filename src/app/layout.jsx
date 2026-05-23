import "./globals.css";

export const metadata = {
  title: "Multa.AI — Recursos Administrativos de Trânsito",
  description: "Recorra sua multa de trânsito com inteligência artificial. Recurso completo fundamentado no CTB em segundos.",
  keywords: "multa trânsito, recurso administrativo, CTB, JARI, defesa multa",
  openGraph: {
    title: "Multa.AI — Cada multa tem uma defesa. A sua também.",
    description: "Gere seu recurso administrativo de trânsito com IA em segundos.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
