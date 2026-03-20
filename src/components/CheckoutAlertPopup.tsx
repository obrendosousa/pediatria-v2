'use client';

import { useCheckoutNotifications } from '@/contexts/CheckoutNotificationContext';
import { DollarSign, X, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CheckoutAlertPopup() {
  const { alerts, dismissAlert, dismissAllAlerts } = useCheckoutNotifications();
  const router = useRouter();

  if (alerts.length === 0) return null;

  function handleGoToCheckout(alertId: number) {
    dismissAlert(alertId);
    router.push('/crm');
  }

  return (
    <div className="fixed bottom-4 right-4 z-[200] space-y-2 max-w-sm">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="bg-white dark:bg-[#141419] rounded-xl shadow-2xl border border-purple-200 dark:border-purple-800/60 overflow-hidden animate-in slide-in-from-bottom fade-in"
        >
          <div className="bg-purple-500 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-white" />
              <span className="text-xs font-bold text-white uppercase tracking-wide">
                Checkout Pendente
              </span>
            </div>
            <button
              type="button"
              onClick={() => dismissAlert(alert.id)}
              className="p-0.5 hover:bg-white/20 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
          <div className="p-4">
            <p className="text-sm font-semibold text-slate-800 dark:text-[#fafafa] mb-1">
              {alert.patientName}
            </p>
            <p className="text-xs text-slate-500 dark:text-[#a1a1aa] mb-3">
              Dra. finalizou o atendimento. Realize o checkout / pagamento.
            </p>
            <button
              type="button"
              onClick={() => handleGoToCheckout(alert.id)}
              className="w-full bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
            >
              Ir para Checkout <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
      {alerts.length > 1 && (
        <button
          type="button"
          onClick={dismissAllAlerts}
          className="w-full text-center text-xs text-slate-500 dark:text-[#a1a1aa] hover:text-slate-700 dark:hover:text-white py-1 transition-colors"
        >
          Dispensar todos ({alerts.length})
        </button>
      )}
    </div>
  );
}
