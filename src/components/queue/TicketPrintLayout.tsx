'use client';

import type { KioskCategory } from '@/types/queue';

interface TicketPrintLayoutProps {
  ticketNumber: string;
  categoryLabel: string;
  category: KioskCategory;
  createdAt: string;
  estimatedWaitMinutes: number;
  clinicName?: string;
  location?: string;
}

/** Layout de impressão otimizado para papel térmico 80mm (Elgin i8) */
export default function TicketPrintLayout({
  ticketNumber,
  categoryLabel,
  createdAt,
  estimatedWaitMinutes,
  clinicName = 'CENTRO MÉDICO',
  location = 'TÉRREO',
}: TicketPrintLayoutProps) {
  // Formatar data/hora no padrão BR
  const dt = new Date(createdAt);
  const dataFormatada = dt.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const horaFormatada = dt.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Extrair só o número (sem prefixo) para exibição grande
  const numberOnly = ticketNumber.replace(/^[A-Z]+/, '');

  return (
    <>
      {/* Estilos de impressão para papel térmico 80mm */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          #ticket-print-area,
          #ticket-print-area * {
            visibility: visible !important;
          }
          #ticket-print-area {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            padding: 2mm !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
            z-index: 99999 !important;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      ` }} />

      {/* Área de impressão — invisível na tela, visível apenas no print */}
      <div
        id="ticket-print-area"
        className="hidden print:block"
        style={{ fontFamily: 'monospace, Courier New, Courier' }}
      >
        {/* Logo / Nome da Clínica */}
        <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '1px' }}>
            {clinicName}
          </div>
          <div style={{
            borderBottom: '1px dashed #000',
            margin: '2mm 0',
          }} />
        </div>

        {/* Senha + Tipo */}
        <div style={{ textAlign: 'center', marginBottom: '3mm' }}>
          <div style={{ fontSize: '28px', fontWeight: 'bold', lineHeight: 1.2 }}>
            SENHA: {numberOnly}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '1mm' }}>
            TIPO: {categoryLabel}
          </div>
        </div>

        {/* Separador */}
        <div style={{
          borderBottom: '1px dashed #000',
          margin: '2mm 0',
        }} />

        {/* Local */}
        <div style={{ textAlign: 'center', fontSize: '12px', marginBottom: '2mm' }}>
          LOCAL: {location}
        </div>

        {/* Data/Hora + Tempo médio */}
        <div style={{ textAlign: 'center', fontSize: '10px', lineHeight: 1.4 }}>
          <div>
            Chegada: {dataFormatada} {horaFormatada}
          </div>
          <div>
            Tempo médio de espera: ~{estimatedWaitMinutes} min
          </div>
        </div>

        {/* Separador final */}
        <div style={{
          borderBottom: '1px dashed #000',
          margin: '3mm 0 1mm',
        }} />

        {/* Rodapé */}
        <div style={{ textAlign: 'center', fontSize: '9px', color: '#555' }}>
          Aguarde sua senha ser chamada no painel
        </div>

        {/* Espaço para corte */}
        <div style={{ height: '5mm' }} />
      </div>
    </>
  );
}
