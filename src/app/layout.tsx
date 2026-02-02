import './globals.css';
import { Inter, Nunito } from 'next/font/google';
import Navigation from '@/components/Navigation';
import SidebarWrapper from '@/components/SidebarWrapper';
import { SidebarProvider } from '@/contexts/SidebarContext';
import type { Metadata } from 'next';

// Fonte Padrão (Leitura - mantém a seriedade nos textos longos)
const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Fonte "Fofa" (Títulos e Destaques - Arredondada)
const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  weight: ['400', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Aliança Kids',
  description: 'Sistema de Gestão Pediátrica',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* ATUALIZADO: Cor exata do novo tema escuro (#1e2028) */}
        <meta name="theme-color" content="#fdfbf7" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1e2028" media="(prefers-color-scheme: dark)" />
      </head>
      
      <body 
        className={`${inter.variable} ${nunito.variable} font-sans antialiased bg-[rgb(var(--background))] text-[rgb(var(--foreground))] overflow-hidden selection:bg-pink-200 selection:text-pink-900`} 
        suppressHydrationWarning={true}
      >
        <SidebarProvider>
        <div className="flex h-screen w-full transition-colors duration-500">
          
          <SidebarWrapper>
            <Navigation />
          </SidebarWrapper>
          
            <main className="flex-1 overflow-hidden relative w-full h-full transition-all duration-500 ease-in-out">
            {children}
          </main>
        </div>
        </SidebarProvider>
      </body>
    </html>
  );
}