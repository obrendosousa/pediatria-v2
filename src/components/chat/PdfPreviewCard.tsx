"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Eye, FileText, Loader2 } from "lucide-react";

interface PdfPreviewCardProps {
  url: string;
  fileName: string;
  fileSize?: string | null;
}

/**
 * Card de PDF estilo WhatsApp: preview proporcional do topo da primeira página,
 * rodapé vermelho com nome do arquivo e botões Visualizar / Baixar.
 */
export default function PdfPreviewCard({ url, fileName, fileSize }: PdfPreviewCardProps) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [pageCount, setPageCount] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!url) { setStatus("error"); return; }
    let cancelled = false;

    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const pdf = await pdfjsLib.getDocument(url).promise;
        if (cancelled) return;
        setPageCount(pdf.numPages);

        const page = await pdf.getPage(1);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const renderWidth = 520;
        const scale = renderWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvasRef.current = canvas;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { setStatus("error"); return; }

        // @ts-expect-error — pdfjs-dist v5 RenderParameters type mismatch
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (cancelled) return;

        // Converte para imagem para usar object-fit: cover corretamente
        setPreviewSrc(canvas.toDataURL("image/jpeg", 0.85));
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => { cancelled = true; };
  }, [url]);

  function handleDownload() {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "documento.pdf";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handleView() {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const displayName = fileName.replace(/\.pdf$/i, "");
  const pageLabel = pageCount ? `${pageCount} ${pageCount > 1 ? "paginas" : "pagina"}` : null;
  const metaParts = ["PDF", fileSize, pageLabel].filter(Boolean).join(" \u00B7 ");

  return (
    <div className="w-[280px] overflow-hidden">
      {/* ── Preview: topo proporcional da página 1 ─────────────────────── */}
      <div className="relative w-full h-[140px] bg-[#f0f0f0] dark:bg-[#1a1a22] overflow-hidden rounded-t-lg">
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-gray-400" />
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 bg-gradient-to-b from-gray-100 to-gray-200 dark:from-[#1a1a22] dark:to-[#12121a] flex items-center justify-center">
            <div className="w-12 h-[60px] bg-white dark:bg-[#2d2d36] rounded shadow-md flex items-end justify-center pb-2 relative">
              <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-gray-200 dark:bg-[#3d3d48] rounded-bl" />
              <FileText size={20} className="text-rose-400" />
            </div>
          </div>
        )}

        {previewSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewSrc}
            alt="Preview PDF"
            className="w-full h-full object-cover object-top"
          />
        )}

        {/* Gradiente sutil na base para transição pro rodapé */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
      </div>

      {/* ── Rodapé vermelho estilo WhatsApp ────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-3 py-2 bg-[#e04f5f] dark:bg-[#c0392b]">
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <FileText size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold truncate text-white leading-tight">
            {displayName}
          </p>
          <p className="text-[10px] text-white/70 mt-0.5">
            {metaParts}
          </p>
        </div>
      </div>

      {/* ── Botões Visualizar / Baixar ─────────────────────────────────── */}
      <div className="flex bg-white dark:bg-[#111b21] border-t border-black/5 dark:border-white/5">
        <button
          onClick={handleView}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium text-[#e04f5f] dark:text-[#e74c3c] hover:bg-rose-50/60 dark:hover:bg-rose-900/10 transition-colors"
        >
          <Eye size={14} />
          Visualizar
        </button>
        <div className="w-px bg-black/8 dark:bg-white/8" />
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1c1c21] transition-colors"
        >
          <Download size={14} />
          Baixar
        </button>
      </div>
    </div>
  );
}
