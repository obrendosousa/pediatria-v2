'use client';

import { useState, useRef } from 'react';
import { Plus, Trash2, GripVertical, Image, FileText, Mic, Type, Clock, X } from 'lucide-react';
import { AutomationMessage } from '@/types';
import { supabase } from '@/lib/supabase';
import { AVAILABLE_VARIABLES } from '@/utils/automationVariables';

interface MessageSequenceBuilderProps {
  messages: AutomationMessage[];
  onChange: (messages: AutomationMessage[]) => void;
  previewData?: any; // Dados para preview com variáveis
}

export default function MessageSequenceBuilder({
  messages,
  onChange,
  previewData
}: MessageSequenceBuilderProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const addMessage = (type: AutomationMessage['type']) => {
    const newMessage: AutomationMessage = {
      type,
      content: '',
      delay: type === 'text' ? 0 : 2, // Delay padrão de 2s para mídia
    };
    onChange([...messages, newMessage]);
  };

  const removeMessage = (index: number) => {
    onChange(messages.filter((_, i) => i !== index));
  };

  const updateMessage = (index: number, updates: Partial<AutomationMessage>) => {
    const updated = [...messages];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const handleFileUpload = async (file: File, index: number, type: 'audio' | 'image' | 'document') => {
    setUploadingIndex(index);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `automation/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('midia')
        .upload(fileName, file, { contentType: file.type });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('midia').getPublicUrl(fileName);
      
      updateMessage(index, { content: publicUrl });
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      alert('Erro ao fazer upload do arquivo');
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    
    if (draggedIndex !== index) {
      const newMessages = [...messages];
      const [removed] = newMessages.splice(draggedIndex, 1);
      newMessages.splice(index, 0, removed);
      onChange(newMessages);
      setDraggedIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const getMessageIcon = (type: AutomationMessage['type']) => {
    switch (type) {
      case 'text': return <Type className="w-4 h-4" />;
      case 'audio': return <Mic className="w-4 h-4" />;
      case 'image': return <Image className="w-4 h-4" />;
      case 'document': return <FileText className="w-4 h-4" />;
    }
  };

  const getMessageTypeLabel = (type: AutomationMessage['type']) => {
    switch (type) {
      case 'text': return 'Texto';
      case 'audio': return 'Áudio';
      case 'image': return 'Imagem';
      case 'document': return 'Documento';
    }
  };

  return (
    <div className="space-y-4">
      {/* Botões para adicionar mensagens */}
      <div className="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-[#2a2d36] rounded-xl border border-slate-200 dark:border-gray-700">
        <span className="text-sm font-bold text-slate-600 dark:text-gray-400 w-full mb-2">Adicionar Mensagem:</span>
        <button
          onClick={() => addMessage('text')}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-sm font-medium text-slate-700 dark:text-gray-300"
        >
          <Type className="w-4 h-4" />
          Texto
        </button>
        <button
          onClick={() => addMessage('audio')}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-sm font-medium text-slate-700 dark:text-gray-300"
        >
          <Mic className="w-4 h-4" />
          Áudio
        </button>
        <button
          onClick={() => addMessage('image')}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-sm font-medium text-slate-700 dark:text-gray-300"
        >
          <Image className="w-4 h-4" />
          Imagem
        </button>
        <button
          onClick={() => addMessage('document')}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-sm font-medium text-slate-700 dark:text-gray-300"
        >
          <FileText className="w-4 h-4" />
          Documento
        </button>
      </div>

      {/* Lista de mensagens */}
      {messages.length === 0 ? (
        <div className="text-center py-8 text-slate-400 dark:text-gray-500 text-sm">
          Nenhuma mensagem adicionada. Clique nos botões acima para adicionar.
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((message, index) => (
            <div
              key={index}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex gap-3 p-4 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-xl transition-all ${
                draggedIndex === index ? 'opacity-50' : 'hover:border-rose-300 dark:hover:border-rose-700'
              }`}
            >
              {/* Handle de arrastar */}
              <button
                className="flex items-center text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 cursor-move"
                title="Arrastar para reordenar"
              >
                <GripVertical className="w-5 h-5" />
              </button>

              {/* Ícone do tipo */}
              <div className="flex items-center justify-center w-10 h-10 bg-slate-100 dark:bg-[#2a2d36] rounded-lg shrink-0">
                {getMessageIcon(message.type)}
              </div>

              {/* Conteúdo */}
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-700 dark:text-gray-200">
                    {index + 1}. {getMessageTypeLabel(message.type)}
                  </span>
                  <button
                    onClick={() => removeMessage(index)}
                    className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-slate-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Campo de conteúdo baseado no tipo */}
                {message.type === 'text' ? (
                  <textarea
                    value={message.content}
                    onChange={(e) => updateMessage(index, { content: e.target.value })}
                    placeholder="Digite a mensagem... Use {nome_paciente}, {idade}, etc. para personalizar"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-700 dark:text-gray-200 placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 resize-none"
                    rows={3}
                  />
                ) : (
                  <div className="space-y-2">
                    {message.content ? (
                      <div className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-900/30">
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex-1 truncate">
                          {message.content}
                        </span>
                        <button
                          onClick={() => updateMessage(index, { content: '' })}
                          className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded"
                        >
                          <X className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept={
                            message.type === 'audio' ? 'audio/*' :
                            message.type === 'image' ? 'image/*' :
                            'application/pdf,.doc,.docx'
                          }
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFileUpload(file, index, message.type);
                            }
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingIndex === index}
                          className="w-full px-4 py-2 bg-slate-100 dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-colors text-sm font-medium text-slate-700 dark:text-gray-300 disabled:opacity-50"
                        >
                          {uploadingIndex === index ? 'Fazendo upload...' : `Selecionar ${getMessageTypeLabel(message.type)}`}
                        </button>
                      </div>
                    )}
                    
                    {(message.type === 'image' || message.type === 'document') && (
                      <textarea
                        value={message.caption || ''}
                        onChange={(e) => updateMessage(index, { caption: e.target.value })}
                        placeholder="Legenda (opcional)... Use variáveis para personalizar"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-700 dark:text-gray-200 placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 resize-none"
                        rows={2}
                      />
                    )}
                  </div>
                )}

                {/* Delay entre mensagens */}
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400 dark:text-gray-500" />
                  <label className="text-xs text-slate-600 dark:text-gray-400">
                    Delay antes de enviar:
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={message.delay || 0}
                    onChange={(e) => updateMessage(index, { delay: parseInt(e.target.value) || 0 })}
                    className="w-20 px-2 py-1 bg-slate-50 dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <span className="text-xs text-slate-500 dark:text-gray-500">segundos</span>
                </div>

                {/* Preview (se houver dados de preview) */}
                {previewData && message.type === 'text' && message.content && (
                  <div className="mt-2 p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-900/30">
                    <div className="text-xs font-bold text-rose-700 dark:text-rose-400 mb-1">Preview:</div>
                    <div className="text-sm text-slate-700 dark:text-gray-200 whitespace-pre-wrap">
                      {/* Preview será processado pelo componente pai com replaceVariables */}
                      {message.content}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ajuda com variáveis */}
      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-900/30">
        <div className="text-sm font-bold text-blue-700 dark:text-blue-400 mb-2">
          Variáveis Disponíveis:
        </div>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_VARIABLES.slice(0, 6).map((variable) => (
            <button
              key={variable.key}
              onClick={() => {
                const lastMessage = messages[messages.length - 1];
                if (lastMessage && lastMessage.type === 'text') {
                  const index = messages.length - 1;
                  updateMessage(index, {
                    content: lastMessage.content + `{${variable.key}}`
                  });
                }
              }}
              className="px-2 py-1 bg-white dark:bg-[#1e2028] border border-blue-200 dark:border-blue-800 rounded text-xs font-mono text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              title={variable.description}
            >
              {'{' + variable.key + '}'}
            </button>
          ))}
        </div>
        <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
          Clique em uma variável para adicionar ao texto. Use {'{nome_paciente}'}, {'{idade}'}, etc.
        </div>
      </div>
    </div>
  );
}
