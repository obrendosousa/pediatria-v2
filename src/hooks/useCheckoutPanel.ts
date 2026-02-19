'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Appointment } from '@/types/medical';
import { Product } from '@/types';
import { normalizePaymentSplits, resolveSalePaymentMethodFromSplits } from '@/lib/finance';
import { createFinancialTransaction } from '@/lib/financialTransactions';
import { useAuth } from '@/contexts/AuthContext';

const supabase = createClient();

export interface SelectedItem {
  id: number | string;
  qty: number;
  type: 'product' | 'service' | 'debt' | 'medical_item';
  name: string;
  price: number;
  product?: Product;
}

export interface MedicalCheckoutData {
  id: number;
  consultation_value?: number;
  return_date?: string | null;
  return_obs?: string | null;
  secretary_notes?: string | null;
  checkout_items?: Array<{
    id: number;
    product_id: number;
    quantity: number;
    products?: Array<{ id: number; name: string; price_sale: number }> | null;
  }>;
}

export function useCheckoutPanel(appointmentId: number | null) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [medicalCheckout, setMedicalCheckout] = useState<MedicalCheckoutData | null>(null);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [medicalCheckoutId, setMedicalCheckoutId] = useState<number | null>(null);

  const loadCheckoutData = useCallback(async () => {
    if (!appointmentId) return;
    try {
      setLoading(true);
      const initialItems: SelectedItem[] = [];

      const { data: aptData, error: aptError } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .single();

      if (aptError) throw aptError;
      const apt = aptData as Appointment;
      setAppointment(apt);

      const totalAgendado = Number(apt.total_amount || 0);
      const pagoAgendado = Number(apt.amount_paid || 0);
      const restanteAgendamento = Math.max(0, totalAgendado - pagoAgendado);

      if (restanteAgendamento > 0) {
        initialItems.push({
          id: 'balance-due',
          qty: 1,
          type: 'debt',
          name: 'Saldo Restante (Agendamento)',
          price: restanteAgendamento
        });
      }

      const { data: mcData } = await supabase
        .from('medical_checkouts')
        .select(`
          id,
          consultation_value,
          return_date,
          return_obs,
          secretary_notes,
          checkout_items (
            id, product_id, quantity,
            products (id, name, price_sale)
          )
        `)
        .eq('appointment_id', appointmentId)
        .eq('status', 'pending')
        .maybeSingle();

      if (mcData) {
        setMedicalCheckoutId(mcData.id);
        setMedicalCheckout(mcData as unknown as MedicalCheckoutData);

        if (mcData.consultation_value && mcData.consultation_value > 0) {
          initialItems.push({
            id: 'medical-consultation',
            qty: 1,
            type: 'medical_item',
            name: 'Valor Consulta (Adicional)',
            price: mcData.consultation_value
          });
        }

        const items = ((mcData.checkout_items || []) as unknown) as NonNullable<MedicalCheckoutData['checkout_items']>;
        items.forEach((item) => {
          const productRow = item.products?.[0];
          if (productRow) {
            initialItems.push({
              id: productRow.id,
              qty: item.quantity,
              type: 'medical_item',
              name: productRow.name,
              price: productRow.price_sale,
              product: (productRow as unknown) as Product
            });
          }
        });
      } else {
        setMedicalCheckout(null);
        setMedicalCheckoutId(null);
      }

      setSelectedItems(initialItems);
    } catch (err) {
      console.error('Erro ao carregar dados do checkout:', err);
      setAppointment(null);
      setMedicalCheckout(null);
      setSelectedItems([]);
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  const fetchCatalog = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('name');
      if (data) setCatalog(data as Product[]);
    } catch (err) {
      console.error('Erro ao buscar catálogo:', err);
    }
  }, []);

  useEffect(() => {
    if (appointmentId) {
      loadCheckoutData();
      fetchCatalog();
      setSearch('');
      setPaymentMethod('cash');
    } else {
      setAppointment(null);
      setMedicalCheckout(null);
      setMedicalCheckoutId(null);
      setSelectedItems([]);
    }
  }, [appointmentId, loadCheckoutData, fetchCatalog]);

  const addItem = useCallback((product: Product, type: 'product' | 'service') => {
    setSelectedItems(prev => {
      const existingIndex = prev.findIndex(i => i.id === product.id && (i.type === type || i.type === 'medical_item'));
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], qty: updated[existingIndex].qty + 1 };
        return updated;
      }
      return [...prev, {
        id: product.id,
        qty: 1,
        type,
        name: product.name,
        price: product.price_sale,
        product
      }];
    });
  }, []);

  const removeItem = useCallback((item: SelectedItem) => {
    setSelectedItems(prev => {
      if (item.type === 'debt') return prev.filter(i => i.id !== item.id);
      const existing = prev.find(i => i.id === item.id);
      if (!existing) return prev;
      if (existing.qty > 1) {
        return prev.map(i => i.id === item.id ? { ...i, qty: i.qty - 1 } : i);
      }
      return prev.filter(i => i.id !== item.id);
    });
  }, []);

  const filteredCatalog = catalog.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const total = selectedItems.reduce((acc, item) => acc + (item.price * item.qty), 0);

  const handlePrintDocuments = useCallback(() => {
    if (!appointment?.patient_id) return;
    window.open(`/print/medical-record/latest/${appointment.patient_id}`, '_blank');
  }, [appointment?.patient_id]);

  const handleSubmit = useCallback(async (onSuccess?: () => void) => {
    if (!appointment || !appointmentId) return;
    setLoading(true);
    try {
      let chatId: number | null = null;
      if (appointment.patient_phone) {
        const cleanPhone = appointment.patient_phone.replace(/\D/g, '');
        const { data: existingChat } = await supabase
          .from('chats')
          .select('id')
          .eq('phone', cleanPhone)
          .maybeSingle();

        if (existingChat) {
          chatId = existingChat.id;
        } else {
          const { data: newChat } = await supabase
            .from('chats')
            .insert({
              phone: cleanPhone,
              contact_name: appointment.patient_name || cleanPhone,
              status: 'ACTIVE',
              created_at: new Date().toISOString(),
              last_interaction_at: new Date().toISOString()
            })
            .select()
            .single();
          if (newChat) chatId = newChat.id;
        }
      }

      const paymentSplits = normalizePaymentSplits(total, paymentMethod);
      const salePaymentMethod = resolveSalePaymentMethodFromSplits(paymentSplits);
      const debtAmount = selectedItems
        .filter((item) => item.type === 'debt')
        .reduce((acc, item) => acc + (item.price * item.qty), 0);
      const consultationValueAmount = selectedItems
        .filter((item) => item.id === 'medical-consultation')
        .reduce((acc, item) => acc + (item.price * item.qty), 0);
      const storeItemsAmount = selectedItems
        .filter((item) => item.type === 'product' || item.type === 'service' || (item.type === 'medical_item' && item.id !== 'medical-consultation'))
        .reduce((acc, item) => acc + (item.price * item.qty), 0);
      const consultationAmount = debtAmount + consultationValueAmount;
      const dominantOrigin = storeItemsAmount > consultationAmount ? 'loja' : 'atendimento';

      if (total > 0) {
        const { data: sale, error: saleError } = await supabase
          .from('sales')
          .insert({
            chat_id: chatId,
            patient_id: appointment.patient_id ?? null,
            total: total,
            status: 'completed',
            payment_method: salePaymentMethod,
            created_by: user?.id ?? null,
            origin: dominantOrigin,
            appointment_id: appointmentId
          })
          .select()
          .single();

        if (saleError) throw saleError;

        for (const item of selectedItems) {
          try {
            await supabase.from('sale_items').insert({
              sale_id: sale.id,
              product_id: item.product?.id || null,
              quantity: item.qty,
              unit_price: item.price
            });
          } catch (itemError) {
            console.error(`Erro ao inserir item ${item.name} na venda:`, itemError);
          }

          if ((item.type === 'product' || item.type === 'medical_item') && item.product) {
            const { data: batches } = await supabase
              .from('product_batches')
              .select('*')
              .eq('product_id', item.product.id)
              .gt('quantity', 0)
              .order('expiration_date', { ascending: true });

            if (batches) {
              let qtyNeed = item.qty;
              for (const batch of batches) {
                if (qtyNeed <= 0) break;
                const take = Math.min(batch.quantity, qtyNeed);
                await supabase
                  .from('product_batches')
                  .update({ quantity: batch.quantity - take })
                  .eq('id', batch.id);
                qtyNeed -= take;
              }
            }
          }
        }

        if (consultationAmount > 0) {
          await createFinancialTransaction(supabase, {
            amount: consultationAmount,
            origin: 'atendimento',
            createdBy: user?.id ?? null,
            appointmentId,
            saleId: sale.id,
            medicalCheckoutId,
            payments: normalizePaymentSplits(consultationAmount, paymentMethod)
          });
        }
        if (storeItemsAmount > 0) {
          await createFinancialTransaction(supabase, {
            amount: storeItemsAmount,
            origin: 'loja',
            createdBy: user?.id ?? null,
            appointmentId,
            saleId: sale.id,
            medicalCheckoutId,
            payments: normalizePaymentSplits(storeItemsAmount, paymentMethod)
          });
        }
      }

      if (medicalCheckoutId) {
        await supabase
          .from('medical_checkouts')
          .update({ status: 'completed' })
          .eq('id', medicalCheckoutId);
      }

      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          status: 'finished',
          amount_paid: Number(appointment.amount_paid || 0) + debtAmount
        })
        .eq('id', appointmentId);

      if (updateError) throw updateError;

      onSuccess?.();
    } catch (error: unknown) {
      console.error('Erro ao processar checkout:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [appointment, appointmentId, total, selectedItems, paymentMethod, medicalCheckoutId, user?.id]);

  return {
    loading,
    appointment,
    medicalCheckout,
    catalog,
    search,
    setSearch,
    selectedItems,
    addItem,
    removeItem,
    total,
    paymentMethod,
    setPaymentMethod,
    medicalCheckoutId,
    filteredCatalog,
    handlePrintDocuments,
    handleSubmit,
    loadCheckoutData
  };
}
