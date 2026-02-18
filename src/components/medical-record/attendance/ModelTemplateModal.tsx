'use client';

import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { useToast } from '@/contexts/ToastContext';

interface ModelTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (content: string) => void;
  onSave: (title: string, content: string, type: string) => void;
  type: string;
  currentContent?: string;
}

export function ModelTemplateModal({
  isOpen,
  onClose,
  onSelect,
  onSave,
  type,
  currentContent = ''
}: ModelTemplateModalProps) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [saveMode, setSaveMode] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen, type]);

  async function loadTemplates() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('macros')
        .select('*')
        .eq('type', type)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Erro ao carregar modelos:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!saveTitle.trim() || !currentContent.trim()) {
      toast.toast.error('Preencha o título e o conteúdo para salvar o modelo.');
      return;
    }

    try {
      const { error } = await supabase
        .from('macros')
        .insert({
          title: saveTitle,
          type: type,
          content: currentContent,
          category: 'geral',
        });

      if (error) throw error;

      setSaveMode(false);
      setSaveTitle('');
      loadTemplates();
      toast.toast.success('Modelo salvo com sucesso!');
    } catch (err: any) {
      console.error('Erro ao salvar modelo:', err);
      toast.toast.error('Erro ao salvar modelo: ' + err.message);
    }
  }

  const filteredTemplates = templates.filter(template =>
    template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1e2028] rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-slate-800 dark:text-gray-200">
            {saveMode ? 'Salvar Modelo' : 'Usar Modelo'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-[#2a2d36] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {saveMode ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  Título do Modelo
                </label>
                <input
                  type="text"
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  placeholder="Ex: Exame Físico Padrão"
                  className="w-full px-4 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Salvar
                </button>
                <button
                  onClick={() => {
                    setSaveMode(false);
                    setSaveTitle('');
                  }}
                  className="px-4 py-2 bg-slate-200 dark:bg-[#2a2d36] hover:bg-slate-300 dark:hover:bg-[#353842] text-slate-700 dark:text-gray-200 font-medium rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar modelos..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Templates List */}
              {isLoading ? (
                <div className="text-center py-8 text-slate-500">Carregando...</div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  {searchTerm ? 'Nenhum modelo encontrado.' : 'Nenhum modelo salvo ainda.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => {
                        onSelect(template.content);
                        onClose();
                      }}
                      className="w-full text-left p-4 border border-slate-200 dark:border-gray-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-all"
                    >
                      <div className="font-medium text-slate-800 dark:text-gray-200 mb-1">
                        {template.title}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-gray-400 line-clamp-2">
                        {template.content.replace(/<[^>]*>/g, '').substring(0, 100)}...
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!saveMode && (
          <div className="p-6 border-t border-slate-200 dark:border-gray-700">
            <button
              onClick={() => setSaveMode(true)}
              className="w-full px-4 py-2 bg-slate-100 dark:bg-[#2a2d36] hover:bg-slate-200 dark:hover:bg-[#353842] text-slate-700 dark:text-gray-200 font-medium rounded-lg transition-colors"
            >
              Salvar Novo Modelo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
