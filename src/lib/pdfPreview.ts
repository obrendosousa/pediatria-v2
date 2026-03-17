/**
 * Gera uma imagem preview da primeira página de um PDF.
 * Usa pdfjs-dist para renderizar a página em um canvas offscreen.
 */
export async function generatePdfPreview(pdfSource: string | File): Promise<Blob | null> {
  try {
    const pdfjsLib = await import('pdfjs-dist');

    // Configura o worker via CDN (compatível com Next.js client)
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    let loadingTask;
    if (typeof pdfSource === 'string') {
      // URL do PDF
      loadingTask = pdfjsLib.getDocument(pdfSource);
    } else {
      // File/Blob — converte para ArrayBuffer
      const buffer = await pdfSource.arrayBuffer();
      loadingTask = pdfjsLib.getDocument({ data: buffer });
    }

    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    // Escala para gerar uma imagem de boa qualidade (~800px de largura)
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = 800 / baseViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // @ts-expect-error — pdfjs-dist v5 tipagem RenderParameters incompatível com CanvasRenderingContext2D
    await page.render({ canvasContext: ctx, viewport }).promise;

    // Converte o canvas para JPEG com qualidade 85%
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85);
    });
  } catch (err) {
    console.error('[pdfPreview] Erro ao gerar preview do PDF:', err);
    return null;
  }
}
