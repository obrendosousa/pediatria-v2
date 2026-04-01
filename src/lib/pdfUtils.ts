// @ts-expect-error html2canvas has no type declarations in this project
import html2canvas from 'html2canvas';
// @ts-expect-error jspdf has no type declarations in this project
import jsPDF from 'jspdf';
import { getLetterheadDataUrl } from '@/lib/letterhead';

export async function downloadHtmlAsPdf(html: string, filename: string, useLetterhead: boolean = true) {
  const letterheadPromise = useLetterhead ? getLetterheadDataUrl() : null;

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:white;';
  container.innerHTML = '';

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width:794px;min-height:1123px;border:none;';
  container.appendChild(iframe);
  document.body.appendChild(container);

  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }
    setTimeout(resolve, 1000);
  });

  await new Promise((r) => setTimeout(r, 500));

  try {
    const body = iframe.contentWindow?.document.body;
    if (!body) throw new Error('Erro ao renderizar documento');

    iframe.style.height = body.scrollHeight + 'px';

    const canvas = await html2canvas(body, {
      scale: 2,
      useCORS: true,
      logging: false,
      width: 794,
      height: body.scrollHeight,
      windowWidth: 794,
      backgroundColor: useLetterhead ? null : '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const letterheadDataUrl = letterheadPromise ? await letterheadPromise : null;

    const pdf = new jsPDF('p', 'mm', 'a4');

    if (!letterheadDataUrl) {
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = -(imgHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
    } else {
      const marginTop = 32;
      const marginBottom = 30;
      const usableHeight = pageHeight - marginTop - marginBottom;

      pdf.addImage(letterheadDataUrl, 'PNG', 0, 0, imgWidth, pageHeight);
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

      if (imgHeight > pageHeight) {
        let contentOffset = pageHeight;
        while (contentOffset < imgHeight) {
          pdf.addPage();
          pdf.addImage(letterheadDataUrl, 'PNG', 0, 0, imgWidth, pageHeight);
          const yPos = marginTop - contentOffset;
          pdf.addImage(imgData, 'PNG', 0, yPos, imgWidth, imgHeight);
          contentOffset += usableHeight;
        }
      }
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}
