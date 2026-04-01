import './globals.css';
import { Figtree, Noto_Sans } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { CheckoutNotificationProvider } from '@/contexts/CheckoutNotificationContext';
import { InternalChatProvider } from '@/contexts/InternalChatContext';
import AuthLayoutGuard from '@/components/AuthLayoutGuard';
import CheckoutAlertPopup from '@/components/CheckoutAlertPopup';
import type { Metadata } from 'next';

// Fonte Principal (Heading - limpa, médica, acessível)
const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  display: 'swap',
});

// Fonte Corpo (Leitura - profissional, healthcare)
const notoSans = Noto_Sans({
  subsets: ['latin'],
  variable: '--font-noto-sans',
  weight: ['400', '500', '600', '700'],
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
        className={`${figtree.variable} ${notoSans.variable} font-sans antialiased bg-[rgb(var(--background))] text-[rgb(var(--foreground))] overflow-hidden selection:bg-pink-200 selection:text-pink-900`} 
        suppressHydrationWarning={true}
      >
        <AuthProvider>
          <ToastProvider>
            <CheckoutNotificationProvider>
              <InternalChatProvider>
                <AuthLayoutGuard>{children}</AuthLayoutGuard>
                <CheckoutAlertPopup />
              </InternalChatProvider>
            </CheckoutNotificationProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}