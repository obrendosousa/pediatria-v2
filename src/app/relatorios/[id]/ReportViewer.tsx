"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Calendar, Tag, Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Report {
  id: number;
  titulo: string;
  conteudo_markdown: string;
  tipo: string;
  created_at: string;
}

const TIPO_LABELS: Record<string, string> = {
  analise_chats: "Análise de Conversas",
  financeiro: "Financeiro",
  agendamento: "Agendamento",
  geral: "Relatório Geral",
};

const TIPO_COLORS: Record<string, string> = {
  analise_chats: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  financeiro: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  agendamento: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  geral: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

/** Converte Markdown básico em HTML seguro (sem dependências externas) */
function markdownToHtml(md: string): string {
  return md
    // Títulos
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Linhas horizontais
    .replace(/^---+$/gm, "<hr />")
    // Negrito e itálico
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    // Código inline
    .replace(/`(.+?)`/g, "<code>$1</code>")
    // Listas não ordenadas
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    // Listas ordenadas
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    // Blockquotes
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    // Parágrafos: linhas vazias viram <br>
    .replace(/\n\n/g, "</p><p>")
    // Envolver em parágrafo se não começa com tag
    .replace(/^(?!<[h|u|o|b|l|h|p|c])(.+)$/gm, "<p>$1</p>")
    // Limpar parágrafos dentro de listas/títulos
    .replace(/<(h[1-4]|li|blockquote)><p>(.*?)<\/p><\/(h[1-4]|li|blockquote)>/g, "<$1>$2</$3>")
    // Quebras de linha simples dentro de parágrafos
    .replace(/([^>])\n([^<])/g, "$1<br />$2");
}

export default function ReportViewer({ report }: { report: Report }) {
  const [dateFormatted, setDateFormatted] = useState("");
  const htmlContent = useMemo(() => markdownToHtml(report.conteudo_markdown), [report.conteudo_markdown]);

  useEffect(() => {
    setDateFormatted(
      new Date(report.created_at).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  }, [report.created_at]);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-[#0b141a] print:bg-white print:overflow-visible">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-[#111b21]/90 backdrop-blur-sm print:hidden">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <ArrowLeft size={15} />
            Voltar
          </Link>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${TIPO_COLORS[report.tipo] ?? TIPO_COLORS.geral}`}
            >
              <Tag size={11} />
              {TIPO_LABELS[report.tipo] ?? report.tipo}
            </span>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
            >
              <Printer size={14} />
              Imprimir
            </button>
          </div>
        </div>
      </div>

      {/* Relatório */}
      <div className="mx-auto max-w-4xl px-4 py-10 print:py-6">
        {/* Cabeçalho do documento */}
        <div className="mb-8 print:mb-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0 w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center print:hidden">
              <FileText size={20} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
                {report.titulo}
              </h1>
              {dateFormatted && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                  <Calendar size={13} />
                  Gerado em {dateFormatted} pela Clara IA
                </p>
              )}
            </div>
          </div>
          <hr className="mt-6 border-gray-200 dark:border-gray-700 print:border-gray-300" />
        </div>

        {/* Conteúdo renderizado */}
        <div
          className="report-content text-gray-800 dark:text-gray-200 leading-relaxed"
          // O conteúdo vem do banco interno (gerado pela Clara) — não é input de usuário externo
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />

        {/* Rodapé */}
        <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700 print:mt-8">
          <p className="text-xs text-gray-400 dark:text-gray-600">
            Relatório #{report.id} · Gerado automaticamente pela Clara IA · Painel Clínica
          </p>
        </div>
      </div>

      {/* Estilos do relatório */}
      <style jsx global>{`
        .report-content h1 { font-size: 1.6rem; font-weight: 700; margin: 1.5rem 0 0.75rem; color: inherit; }
        .report-content h2 { font-size: 1.3rem; font-weight: 600; margin: 1.5rem 0 0.5rem; padding-bottom: 0.4rem; border-bottom: 1px solid #e5e7eb; }
        .report-content h3 { font-size: 1.1rem; font-weight: 600; margin: 1.2rem 0 0.4rem; }
        .report-content h4 { font-size: 1rem; font-weight: 600; margin: 1rem 0 0.3rem; }
        .report-content p { margin: 0.6rem 0; }
        .report-content ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
        .report-content ul ul { list-style: circle; margin: 0.25rem 0; }
        .report-content li { margin: 0.25rem 0; }
        .report-content strong { font-weight: 600; }
        .report-content em { font-style: italic; }
        .report-content code { font-family: monospace; font-size: 0.875em; background: rgba(99,102,241,0.1); padding: 0.1em 0.35em; border-radius: 4px; }
        .report-content blockquote { border-left: 3px solid #a855f7; padding-left: 1rem; margin: 0.75rem 0; opacity: 0.8; }
        .report-content hr { margin: 1.5rem 0; border-color: #e5e7eb; }
        @media (prefers-color-scheme: dark) {
          .report-content h2 { border-color: #374151; }
          .report-content hr { border-color: #374151; }
          .report-content code { background: rgba(139,92,246,0.15); }
        }
        @media print {
          .report-content { color: #111; }
          .report-content h2 { border-color: #ccc; }
        }
      `}</style>
    </div>
  );
}
