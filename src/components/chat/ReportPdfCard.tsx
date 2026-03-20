"use client";

import { useEffect, useState } from "react";
import { FileText, Download, ExternalLink, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ReportPdfCardProps {
  reportId: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabase = { from: (table: string) => any };

export default function ReportPdfCard({ reportId }: ReportPdfCardProps) {
  const [titulo, setTitulo] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const supabase = createClient() as unknown as UntypedSupabase;

  useEffect(() => {
    supabase
      .from("clara_reports")
      .select("titulo, created_at")
      .eq("id", reportId)
      .single()
      .then(({ data }: { data: { titulo: string; created_at: string } | null }) => {
        if (data) {
          setTitulo(data.titulo);
          setCreatedAt(
            new Date(data.created_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          );
        }
      });
  }, [reportId, supabase]);

  async function handleDownloadPdf() {
    setIsGenerating(true);
    try {
      const { data } = await supabase
        .from("clara_reports")
        .select("titulo, conteudo_markdown, created_at")
        .eq("id", reportId)
        .single();

      if (!data) return;

      // Import dynamically to avoid SSR issues
      const { jsPDF } = await import("jspdf");

      const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const PAGE_W = 210;
      const PAGE_H = 297;
      const M = { top: 22, bottom: 22, left: 20, right: 20 };
      const CW = PAGE_W - M.left - M.right;
      let y = M.top;

      function checkPage(needed: number) {
        if (y + needed > PAGE_H - M.bottom) {
          doc.addPage();
          y = M.top;
        }
      }

      function strip(text: string): string {
        return text
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .replace(/\*(.*?)\*/g, "$1")
          .replace(/`(.*?)`/g, "$1")
          .replace(/\[\[chat:\d+\|(.*?)\]\]/g, "$1");
      }

      // Header
      doc.setFillColor(139, 92, 246);
      doc.rect(0, 0, PAGE_W, 4, "F");
      y = 14;

      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      const titleLines = doc.splitTextToSize(data.titulo, CW);
      doc.text(titleLines, M.left, y);
      y += titleLines.length * 8 + 3;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(130, 130, 130);
      doc.text(
        `Gerado em ${new Date(data.created_at).toLocaleString("pt-BR")} pela Clara IA`,
        M.left,
        y
      );
      y += 6;

      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.line(M.left, y, PAGE_W - M.right, y);
      y += 6;

      // Content
      const lines = (data.conteudo_markdown as string).split("\n");
      for (const line of lines) {
        const t = line.trim();

        if (t.startsWith("### ")) {
          checkPage(10);
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(50, 50, 50);
          const w = doc.splitTextToSize(strip(t.slice(4)), CW);
          doc.text(w, M.left, y);
          y += w.length * 6 + 3;
        } else if (t.startsWith("## ")) {
          checkPage(12);
          y += 2;
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(40, 40, 40);
          const w = doc.splitTextToSize(strip(t.slice(3)), CW);
          doc.text(w, M.left, y);
          y += w.length * 7 + 2;
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.2);
          doc.line(M.left, y, PAGE_W - M.right, y);
          y += 4;
        } else if (t.startsWith("# ")) {
          checkPage(14);
          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 30, 30);
          const w = doc.splitTextToSize(strip(t.slice(2)), CW);
          doc.text(w, M.left, y);
          y += w.length * 8 + 4;
        } else if (/^[-*_]{3,}$/.test(t)) {
          checkPage(8);
          y += 2;
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.3);
          doc.line(M.left, y, PAGE_W - M.right, y);
          y += 6;
        } else if (/^[-*+]\s/.test(t)) {
          checkPage(6);
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(50, 50, 50);
          const text = strip(t.replace(/^[-*+]\s/, ""));
          const w = doc.splitTextToSize(text, CW - 8);
          doc.text("\u2022", M.left + 2, y);
          doc.text(w, M.left + 8, y);
          y += w.length * 4.5 + 2;
        } else if (/^\d+\.\s/.test(t)) {
          checkPage(6);
          const num = t.match(/^(\d+)\./)?.[1] || "";
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(50, 50, 50);
          doc.text(`${num}.`, M.left + 2, y);
          doc.setFont("helvetica", "normal");
          const text = strip(t.replace(/^\d+\.\s/, ""));
          const w = doc.splitTextToSize(text, CW - 10);
          doc.text(w, M.left + 10, y);
          y += w.length * 4.5 + 2;
        } else if (t.startsWith(">")) {
          checkPage(8);
          doc.setFontSize(10);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(100, 100, 100);
          const text = strip(t.replace(/^>\s?/, ""));
          const w = doc.splitTextToSize(text, CW - 8);
          doc.setDrawColor(168, 85, 247);
          doc.setLineWidth(0.8);
          doc.line(M.left + 2, y - 2, M.left + 2, y + w.length * 4.5);
          doc.text(w, M.left + 6, y);
          y += w.length * 4.5 + 3;
          doc.setTextColor(0, 0, 0);
        } else if (t === "") {
          y += 3;
        } else {
          checkPage(6);
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(50, 50, 50);
          const w = doc.splitTextToSize(strip(t), CW);
          doc.text(w, M.left, y);
          y += w.length * 4.5 + 2;
        }
      }

      // Footer
      const total = doc.getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setFillColor(139, 92, 246);
        doc.rect(0, PAGE_H - 4, PAGE_W, 4, "F");
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Relatorio #${reportId} · Clara IA · Pagina ${p}/${total}`,
          PAGE_W / 2,
          PAGE_H - 7,
          { align: "center" }
        );
      }

      doc.save(`${data.titulo || "Relatorio"}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700/50 rounded-xl p-3 max-w-[88%]">
      <div className="flex items-start gap-2.5">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-800/40 flex items-center justify-center">
          <FileText size={18} className="text-violet-600 dark:text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-violet-800 dark:text-violet-200 truncate">
            {titulo || `Relatorio #${reportId}`}
          </p>
          {createdAt && (
            <p className="text-[10px] text-violet-500 dark:text-violet-400 mt-0.5">
              {createdAt}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-2.5">
        <button
          onClick={handleDownloadPdf}
          disabled={isGenerating}
          className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-50"
        >
          {isGenerating ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Download size={12} />
          )}
          {isGenerating ? "Gerando..." : "Baixar PDF"}
        </button>
        <a
          href={`/relatorios/${reportId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-violet-300 dark:border-violet-600 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-800/30 transition-colors"
        >
          <ExternalLink size={12} />
          Abrir
        </a>
      </div>
    </div>
  );
}
