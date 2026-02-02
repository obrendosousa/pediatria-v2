import { useState, useEffect } from 'react';

/**
 * Hook customizado para debounce de valores
 * Aguarda o usuário parar de digitar antes de retornar o valor
 * 
 * @param value - Valor a ser debounced
 * @param delay - Tempo de espera em milissegundos (padrão: 300ms)
 * @returns Valor debounced
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Criar timer para atualizar o valor após o delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Limpar timer se o valor mudar antes do delay
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
