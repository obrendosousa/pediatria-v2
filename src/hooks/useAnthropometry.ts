// Hook para gerenciar dados de antropometria

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { AnthropometryEntry } from '@/types/anthropometry';
import { calculateBMI } from '@/utils/growthChartUtils';

export function useAnthropometry(patientId: number) {
  const [entries, setEntries] = useState<AnthropometryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscar todas as medições do paciente
  const fetchEntries = useCallback(async () => {
    if (!patientId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('anthropometry_entries')
        .select('*')
        .eq('patient_id', patientId)
        .order('measurement_date', { ascending: false });

      if (fetchError) {
        // Se a tabela não existir, apenas logar e continuar com array vazio
        if (fetchError.code === '42P01' || fetchError.message?.includes('does not exist')) {
          console.warn('Tabela anthropometry_entries não existe ainda. Execute o script SQL para criá-la.');
          setEntries([]);
          setError(null); // Não tratar como erro crítico
        } else {
          throw fetchError;
        }
      } else {
        setEntries(data || []);
        setError(null);
      }
    } catch (err: any) {
      console.error('Erro ao buscar medições:', err);
      setError(err.message || 'Erro ao buscar medições');
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  // Adicionar nova medição
  const addEntry = useCallback(async (entry: Omit<AnthropometryEntry, 'id' | 'created_at'>) => {
    try {
      // Calcular IMC se peso e altura estiverem presentes
      let bmi = entry.bmi;
      if (!bmi && entry.weight_kg && entry.height_cm) {
        bmi = calculateBMI(entry.weight_kg, entry.height_cm);
      }

      const entryToInsert = {
        ...entry,
        bmi: bmi || null,
      };

      const { data, error: insertError } = await supabase
        .from('anthropometry_entries')
        .insert(entryToInsert)
        .select()
        .single();

      if (insertError) {
        // Se a tabela não existir, mostrar mensagem mais clara
        if (insertError.code === '42P01' || insertError.message?.includes('does not exist')) {
          throw new Error('Tabela anthropometry_entries não existe. Execute o script SQL em database/create_anthropometry_entries_table.sql');
        }
        throw insertError;
      }

      // Atualizar lista local
      setEntries(prev => [data, ...prev].sort((a, b) => {
        const dateA = a.measurement_date || '';
        const dateB = b.measurement_date || '';
        return dateB.localeCompare(dateA);
      }));

      return data;
    } catch (err: any) {
      console.error('Erro ao adicionar medição:', err);
      throw err;
    }
  }, []);

  // Atualizar medição existente
  const updateEntry = useCallback(async (id: number, updates: Partial<AnthropometryEntry>) => {
    try {
      // Recalcular IMC se peso ou altura foram alterados
      let bmi = updates.bmi;
      if (updates.weight_kg !== undefined || updates.height_cm !== undefined) {
        const entry = entries.find(e => e.id === id);
        const weight = updates.weight_kg ?? entry?.weight_kg;
        const height = updates.height_cm ?? entry?.height_cm;
        
        if (weight && height) {
          bmi = calculateBMI(weight, height);
        }
      }

      const { data, error: updateError } = await supabase
        .from('anthropometry_entries')
        .update({
          ...updates,
          bmi: bmi !== undefined ? bmi : updates.bmi,
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Atualizar lista local
      setEntries(prev => prev.map(e => e.id === id ? data : e));

      return data;
    } catch (err: any) {
      console.error('Erro ao atualizar medição:', err);
      throw err;
    }
  }, [entries]);

  // Deletar medição
  const deleteEntry = useCallback(async (id: number) => {
    try {
      const { error: deleteError } = await supabase
        .from('anthropometry_entries')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw deleteError;
      }

      // Atualizar lista local
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch (err: any) {
      console.error('Erro ao deletar medição:', err);
      throw err;
    }
  }, []);

  // Buscar ao montar ou quando patientId mudar
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  return {
    entries,
    isLoading,
    error,
    fetchEntries,
    addEntry,
    updateEntry,
    deleteEntry,
  };
}
