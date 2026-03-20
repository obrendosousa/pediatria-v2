/**
 * Gera PDF de um relatório Clara a partir do conteúdo markdown.
 * Usa jsPDF (server-side compatible) para criar o PDF sem dependências de DOM.
 */
import { jsPDF } from 'jspdf';

/** Remove marcadores markdown inline (bold, italic, code) */
function stripInlineMd(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[\[chat:\d+\|(.*?)\]\]/g, '$1'); // links de chat Clara
}

/** Detecta se o trecho entre ** é bold e retorna segmentos */
function parseBoldSegments(text: string): Array<{ text: string; bold: boolean }> {
  const parts: Array<{ text: string; bold: boolean }> = [];
  const regex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: stripInlineMd(text.slice(lastIndex, match.index)), bold: false });
    }
    parts.push({ text: match[1], bold: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ text: stripInlineMd(text.slice(lastIndex)), bold: false });
  }

  return parts.length > 0 ? parts : [{ text: stripInlineMd(text), bold: false }];
}

interface GeneratePdfOptions {
  titulo: string;
  conteudo_markdown: string;
  created_at: string;
  reportId?: number;
}

export async function generateReportPdf({
  titulo,
  conteudo_markdown,
  created_at,
  reportId,
}: GeneratePdfOptions): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

  const PAGE_W = 210;
  const PAGE_H = 297;
  const M = { top: 22, bottom: 22, left: 20, right: 20 };
  const CW = PAGE_W - M.left - M.right; // content width

  let y = M.top;

  function checkPage(needed: number) {
    if (y + needed > PAGE_H - M.bottom) {
      doc.addPage();
      y = M.top;
    }
  }

  // ── Cabeçalho ──────────────────────────────────────────────────────────────

  // Linha decorativa roxa no topo
  doc.setFillColor(139, 92, 246); // violet-500
  doc.rect(0, 0, PAGE_W, 4, 'F');

  y = 14;

  // Título
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  const titleLines = doc.splitTextToSize(titulo, CW);
  doc.text(titleLines, M.left, y);
  y += titleLines.length * 8 + 3;

  // Data
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(130, 130, 130);
  const dateStr = new Date(created_at).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  doc.text(`Gerado em ${dateStr} pela Clara IA`, M.left, y);
  y += 6;

  // Separador
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(M.left, y, PAGE_W - M.right, y);
  y += 6;

  // ── Conteúdo ───────────────────────────────────────────────────────────────

  const rawLines = conteudo_markdown.split('\n');

  for (let li = 0; li < rawLines.length; li++) {
    const line = rawLines[li];
    const trimmed = line.trim();

    // ─ Headings ─
    if (trimmed.startsWith('#### ')) {
      checkPage(8);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      const wrapped = doc.splitTextToSize(stripInlineMd(trimmed.slice(5)), CW);
      doc.text(wrapped, M.left, y);
      y += wrapped.length * 5 + 3;
    } else if (trimmed.startsWith('### ')) {
      checkPage(10);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      const wrapped = doc.splitTextToSize(stripInlineMd(trimmed.slice(4)), CW);
      doc.text(wrapped, M.left, y);
      y += wrapped.length * 6 + 3;
    } else if (trimmed.startsWith('## ')) {
      checkPage(12);
      y += 2;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      const wrapped = doc.splitTextToSize(stripInlineMd(trimmed.slice(3)), CW);
      doc.text(wrapped, M.left, y);
      y += wrapped.length * 7 + 2;
      // Linha sob h2
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.line(M.left, y, PAGE_W - M.right, y);
      y += 4;
    } else if (trimmed.startsWith('# ')) {
      checkPage(14);
      y += 2;
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      const wrapped = doc.splitTextToSize(stripInlineMd(trimmed.slice(2)), CW);
      doc.text(wrapped, M.left, y);
      y += wrapped.length * 8 + 4;

    // ─ HR ─
    } else if (/^[-*_]{3,}$/.test(trimmed)) {
      checkPage(8);
      y += 2;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(M.left, y, PAGE_W - M.right, y);
      y += 6;

    // ─ Blockquote ─
    } else if (trimmed.startsWith('>')) {
      checkPage(8);
      const text = stripInlineMd(trimmed.replace(/^>\s?/, ''));
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      const wrapped = doc.splitTextToSize(text, CW - 8);
      // barra lateral roxa
      doc.setDrawColor(168, 85, 247);
      doc.setLineWidth(0.8);
      doc.line(M.left + 2, y - 2, M.left + 2, y + wrapped.length * 4.5);
      doc.text(wrapped, M.left + 6, y);
      y += wrapped.length * 4.5 + 3;
      doc.setTextColor(0, 0, 0);

    // ─ Bullet list ─
    } else if (/^[-*+]\s/.test(trimmed)) {
      checkPage(6);
      const text = trimmed.replace(/^[-*+]\s/, '');
      const segments = parseBoldSegments(text);
      const fullText = segments.map((s) => s.text).join('');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
      const wrapped = doc.splitTextToSize(fullText, CW - 8);
      doc.text('\u2022', M.left + 2, y);
      doc.text(wrapped, M.left + 8, y);
      y += wrapped.length * 4.5 + 2;

    // ─ Numbered list ─
    } else if (/^\d+\.\s/.test(trimmed)) {
      checkPage(6);
      const num = trimmed.match(/^(\d+)\./)?.[1] || '';
      const text = trimmed.replace(/^\d+\.\s/, '');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
      const fullText = stripInlineMd(text);
      const wrapped = doc.splitTextToSize(fullText, CW - 10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${num}.`, M.left + 2, y);
      doc.setFont('helvetica', 'normal');
      doc.text(wrapped, M.left + 10, y);
      y += wrapped.length * 4.5 + 2;

    // ─ Linha vazia ─
    } else if (trimmed === '') {
      y += 3;

    // ─ Parágrafo ─
    } else {
      checkPage(6);
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      const segments = parseBoldSegments(trimmed);

      // Se o parágrafo é todo texto sem bold, renderiza simples
      if (segments.length === 1 && !segments[0].bold) {
        doc.setFont('helvetica', 'normal');
        const wrapped = doc.splitTextToSize(segments[0].text, CW);
        doc.text(wrapped, M.left, y);
        y += wrapped.length * 4.5 + 2;
      } else {
        // Renderiza com bold inline (fallback para texto plano com bold)
        const fullText = segments.map((s) => s.text).join('');
        doc.setFont('helvetica', 'normal');
        const wrapped = doc.splitTextToSize(fullText, CW);
        doc.text(wrapped, M.left, y);
        y += wrapped.length * 4.5 + 2;
      }
    }
  }

  // ── Rodapé em todas as páginas ─────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Linha decorativa roxa no rodapé
    doc.setFillColor(139, 92, 246);
    doc.rect(0, PAGE_H - 4, PAGE_W, 4, 'F');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    const footerText = reportId
      ? `Relatório #${reportId} · Clara IA · Página ${p}/${totalPages}`
      : `Clara IA · Página ${p}/${totalPages}`;
    doc.text(footerText, PAGE_W / 2, PAGE_H - 7, { align: 'center' });
  }

  // Retorna como Buffer (compatível com upload Supabase Storage)
  return Buffer.from(doc.output('arraybuffer'));
}
