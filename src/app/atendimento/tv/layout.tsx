'use client';

/**
 * Layout dedicado para o Painel TV — remove sidebar e navigation.
 * A tela fica 100% fullscreen sem nenhum elemento de menu.
 */
export default function TVLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-black">
      {children}
    </div>
  );
}
