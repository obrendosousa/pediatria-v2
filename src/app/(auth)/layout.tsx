import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Entrar | Aliança Kids',
  description: 'Acesso ao sistema',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[rgb(var(--background))] p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
