/**
 * Utilitário para carregar o papel timbrado e usá-lo como fundo em PDFs e impressões.
 * Usa pdfjs-dist para renderizar a primeira página do PDF do timbrado em um canvas.
 */

let cachedDataUrl: string | null = null;

/** Margens em mm para o conteúdo não sobrepor o timbrado */
export const LETTERHEAD_MARGINS = {
  top: 30,    // abaixo do logo + QR code
  bottom: 22, // acima do rodapé com contatos
  left: 20,
  right: 20,
};

/**
 * Carrega o PDF do papel timbrado, renderiza a primeira página em alta qualidade
 * e retorna um data URL (PNG). O resultado é cacheado em memória.
 */
export async function getLetterheadDataUrl(): Promise<string> {
  if (cachedDataUrl) return cachedDataUrl;

  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const pdf = await pdfjsLib.getDocument('/letterhead.pdf').promise;
  const page = await pdf.getPage(1);

  // Escala alta para boa qualidade no PDF final (A4 = 210x297mm ≈ 794x1123px @96dpi)
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = 1588 / baseViewport.width; // 2x A4 width for quality
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível criar canvas para o timbrado');

  // @ts-expect-error — pdfjs-dist v5 tipagem RenderParameters incompatível com CanvasRenderingContext2D
  await page.render({ canvasContext: ctx, viewport }).promise;

  cachedDataUrl = canvas.toDataURL('image/png');
  return cachedDataUrl;
}

/**
 * Retorna um snippet HTML com a imagem do timbrado posicionada como fundo.
 * Usado nas funções de impressão (window.print) para que o timbrado apareça ao imprimir.
 */
export function getLetterheadHtmlSnippet(dataUrl: string): string {
  return `<img src="${dataUrl}" style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;" />`;
}

/**
 * Abre uma janela de impressão com o conteúdo HTML e o timbrado como fundo.
 * Substitui o padrão window.open() + win.document.write() + win.print().
 */
export async function printWithLetterhead(bodyContent: string, title: string = 'Impressão'): Promise<void> {
  const dataUrl = await getLetterheadDataUrl();
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #333; background: transparent; }
  .page { width: 210mm; min-height: 297mm; padding: 32mm 20mm 28mm; margin: 0 auto; }
  h1 { font-size: 18px; margin-bottom: 8px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 16px; }
  hr { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
  .content { font-size: 14px; line-height: 1.6; }
  table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #ccc; padding: 6px 10px; }
  img:not(.letterhead-bg) { max-width: 100%; }
  @page { size: A4; margin: 0; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .letterhead-bg { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; pointer-events: none; }
  }
</style></head>
<body>
  <img class="letterhead-bg" src="${dataUrl}" style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;" />
  <div class="page">${bodyContent}</div>
</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}
