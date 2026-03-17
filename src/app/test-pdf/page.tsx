'use client';

import { useState } from 'react';

export default function TestPdfPage() {
  const [status, setStatus] = useState('');

  const testPrescriptionPdf = async () => {
    setStatus('Gerando PDF de Receita...');
    const { generatePrescriptionHTML } = await import(
      '@/components/medical-record/attendance/screens/Prescriptions'
    );
    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).default;
    const { getLetterheadDataUrl } = await import('@/lib/letterhead');

    const draft = {
      medications: [
        { name: 'Amoxicilina 500mg', posology: 'Tomar 1 comprimido de 8 em 8 horas por 7 dias', quantity: 1, unit: 'caixa', receipt_type: 'simples' as const },
        { name: 'Ibuprofeno 400mg', posology: 'Tomar 1 comprimido de 12 em 12 horas se dor ou febre', quantity: 1, unit: 'caixa', receipt_type: 'simples' as const },
      ],
      exams: [],
      vaccines: [],
    };
    const patientData = { name: 'Joao da Silva Teste', cpf: '123.456.789-00' };

    const html = generatePrescriptionHTML(draft, patientData, 'medications');
    await generateAndSavePdf(html, 'teste_receita.pdf', html2canvas, jsPDF, getLetterheadDataUrl);
    setStatus('PDF de Receita gerado!');
  };

  const testDocumentPdf = async () => {
    setStatus('Gerando PDF de Atestado...');
    const { generateDocumentHTML } = await import(
      '@/components/medical-record/attendance/screens/DocumentsAndCertificates'
    );
    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).default;
    const { getLetterheadDataUrl } = await import('@/lib/letterhead');

    const html = generateDocumentHTML(
      'Atestado Médico',
      '2026-03-17',
      '<p>Atesto para os devidos fins que o(a) paciente <strong>Joao da Silva Teste</strong>, portador(a) do CPF 123.456.789-00, esteve sob meus cuidados médicos nesta data, necessitando de afastamento de suas atividades por 3 (três) dias.</p><p>O paciente apresentou quadro compatível com infecção das vias aéreas superiores, sendo prescrito tratamento adequado e orientações de repouso.</p>',
      { doctor_name: 'Dra. Fernanda Santana', full_name: 'Joao da Silva Teste', cpf: '123.456.789-00' }
    );
    await generateAndSavePdf(html, 'teste_atestado.pdf', html2canvas, jsPDF, getLetterheadDataUrl);
    setStatus('PDF de Atestado gerado!');
  };

  const testExamPdf = async () => {
    setStatus('Gerando PDF de Solicitação de Exames...');
    const { generateRequestHTML } = await import(
      '@/components/medical-record/attendance/screens/ExamsAndProcedures'
    );
    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).default;
    const { getLetterheadDataUrl } = await import('@/lib/letterhead');

    const draft = {
      include_date: true,
      request_date: '2026-03-17',
      request_type: 'PARTICULAR',
      clinical_indication: 'Investigação de quadro infeccioso',
      exams: [
        { code: '40301630', name: 'Hemograma Completo', quantity: 1 },
        { code: '40302040', name: 'Proteína C Reativa (PCR)', quantity: 1 },
        { code: '40301974', name: 'Velocidade de Hemossedimentação (VHS)', quantity: 1 },
      ],
    };
    const patientData = { name: 'Joao da Silva Teste', cpf: '123.456.789-00' };

    const html = generateRequestHTML(draft, patientData);
    await generateAndSavePdf(html, 'teste_exames.pdf', html2canvas, jsPDF, getLetterheadDataUrl);
    setStatus('PDF de Solicitação de Exames gerado!');
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function generateAndSavePdf(html: string, filename: string, html2canvas: any, jsPDF: any, getLetterheadDataUrl: () => Promise<string>) {
    const letterheadDataUrl = await getLetterheadDataUrl();

    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;';
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'width:794px;min-height:1123px;border:none;';
    container.appendChild(iframe);
    document.body.appendChild(container);

    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
      const doc = iframe.contentWindow?.document;
      if (doc) { doc.open(); doc.write(html); doc.close(); }
      setTimeout(resolve, 1000);
    });
    await new Promise((r) => setTimeout(r, 500));

    const body = iframe.contentWindow?.document.body;
    if (!body) { document.body.removeChild(container); return; }
    iframe.style.height = body.scrollHeight + 'px';

    const canvas = await html2canvas(body, {
      scale: 2, useCORS: true, logging: false,
      width: 794, height: body.scrollHeight, windowWidth: 794,
      backgroundColor: null,
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pdf = new jsPDF('p', 'mm', 'a4');
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(letterheadDataUrl, 'PNG', 0, 0, imgWidth, pageHeight);
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = -(imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(letterheadDataUrl, 'PNG', 0, 0, imgWidth, pageHeight);
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
    document.body.removeChild(container);
  }

  return (
    <div style={{ padding: 40, fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ marginBottom: 24 }}>Teste de PDFs com Papel Timbrado</h1>
      <p style={{ marginBottom: 24, color: '#666' }}>
        Clique nos botoes abaixo para gerar PDFs de teste e verificar o enquadramento do timbrado.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <button onClick={testPrescriptionPdf} style={btnStyle}>
          Gerar PDF - Receita Medica
        </button>
        <button onClick={testDocumentPdf} style={btnStyle}>
          Gerar PDF - Atestado Medico
        </button>
        <button onClick={testExamPdf} style={btnStyle}>
          Gerar PDF - Solicitacao de Exames
        </button>
      </div>
      {status && (
        <div style={{ padding: 12, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, color: '#0369a1' }}>
          {status}
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '12px 24px',
  background: '#2563eb',
  color: 'white',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 'bold',
  cursor: 'pointer',
};
