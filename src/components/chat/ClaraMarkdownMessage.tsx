'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface Props {
  text: string;
}

const components: Components = {
  // Títulos
  h1: ({ children }) => (
    <h1 className="text-[20px] font-bold mt-4 mb-2 text-[#111b21] dark:text-[#e9edef] leading-tight">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[17px] font-bold mt-3 mb-1.5 text-[#111b21] dark:text-[#e9edef] leading-tight">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[15px] font-semibold mt-3 mb-1 text-[#111b21] dark:text-[#e9edef] leading-snug">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-[14px] font-semibold mt-2 mb-0.5 text-[#111b21] dark:text-[#e9edef]">
      {children}
    </h4>
  ),

  // Parágrafo
  p: ({ children }) => (
    <p className="mb-1.5 last:mb-0 leading-relaxed text-[#111b21] dark:text-[#e9edef]">
      {children}
    </p>
  ),

  // Negrito e itálico
  strong: ({ children }) => (
    <strong className="font-semibold text-[#111b21] dark:text-[#e9edef]">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-[#111b21] dark:text-[#e9edef]">{children}</em>
  ),

  // Listas não-ordenadas
  ul: ({ children }) => (
    <ul className="my-1 pl-4 space-y-0.5 list-none">{children}</ul>
  ),
  // Listas ordenadas
  ol: ({ children }) => (
    <ol className="my-1 pl-4 space-y-0.5 list-decimal">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-[#111b21] dark:text-[#e9edef] flex gap-1.5 items-start">
      <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-[#54656f] dark:bg-[#8696a0] flex-shrink-0" />
      <span className="flex-1">{children}</span>
    </li>
  ),

  // Linha horizontal
  hr: () => (
    <hr className="my-2 border-0 border-t border-black/10 dark:border-white/10" />
  ),

  // Código inline
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <code className="block bg-black/5 dark:bg-white/5 rounded-md px-3 py-2 text-[11px] font-mono overflow-x-auto text-[#111b21] dark:text-[#e9edef] my-1.5">
          {children}
        </code>
      );
    }
    return (
      <code className="bg-black/8 dark:bg-white/10 rounded px-1 py-0.5 text-[11px] font-mono text-[#111b21] dark:text-[#e9edef]">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-black/5 dark:bg-white/5 rounded-md overflow-x-auto my-1.5">{children}</pre>
  ),

  // Tabelas (GFM)
  table: ({ children }) => (
    <div className="overflow-x-auto my-2 rounded-md border border-black/10 dark:border-white/10">
      <table className="w-full text-[12px] border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-black/5 dark:bg-white/5">{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-t border-black/10 dark:border-white/10">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-1.5 text-left font-semibold text-[#111b21] dark:text-[#e9edef]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-1.5 text-[#111b21] dark:text-[#e9edef]">{children}</td>
  ),

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[#54656f] dark:border-[#8696a0] pl-3 my-1.5 text-[#54656f] dark:text-[#8696a0] italic">
      {children}
    </blockquote>
  ),

  // Links (sem navegação — segurança)
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#027eb5] dark:text-[#53bdeb] underline underline-offset-2 break-all"
    >
      {children}
    </a>
  ),
};

// Listas não-ordenadas com bullet customizado (sem o marcador padrão do browser)
const componentsWithCustomBullet: Components = {
  ...components,
  // Sobrescreve ol li para manter o número em vez do bullet
  ol: ({ children }) => (
    <ol className="my-1 pl-5 space-y-0.5 list-decimal">{children}</ol>
  ),
  li: ({ children, ...props }) => {
    // Detecta se é item de lista ordenada pelo contexto do pai
    const isOrdered = (props as any).ordered;
    if (isOrdered) {
      return (
        <li className="text-[#111b21] dark:text-[#e9edef] pl-0.5">
          {children}
        </li>
      );
    }
    return (
      <li className="text-[#111b21] dark:text-[#e9edef] flex gap-1.5 items-start list-none">
        <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-[#54656f] dark:bg-[#8696a0] flex-shrink-0" />
        <span className="flex-1">{children}</span>
      </li>
    );
  },
};

export default function ClaraMarkdownMessage({ text }: Props) {
  return (
    <div className="clara-markdown text-[14.2px] leading-relaxed break-words min-w-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={componentsWithCustomBullet}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
