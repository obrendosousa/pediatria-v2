'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Smile, X, Send, Loader2, Save, Trash2, Edit2, Check, Paperclip } from 'lucide-react';
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react';
import { supabase } from '@/lib/supabase';

interface SavedMessage {
  id: number;
  content: string;
  created_at: string;
}

interface CallMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (message: string, audioBlob?: Blob) => Promise<void>;
  title: string;
  subtitle?: string;
  isLoading?: boolean;
  defaultMessage?: string;
}

export default function CallMessageModal({
  isOpen,
  onClose,
  onSend,
  title,
  subtitle,
  isLoading = false,
  defaultMessage = "Olá! Sua vez chegou. Por favor, dirija-se ao consultório."
}: CallMessageModalProps) {
  const [message, setMessage] = useState(defaultMessage);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSavedMessages, setShowSavedMessages] = useState(false);
  const [savedMessages, setSavedMessages] = useState<SavedMessage[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  
  // Estados de gravação de áudio
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Carregar mensagens salvas
  useEffect(() => {
    if (isOpen) {
      loadSavedMessages();
      setMessage(defaultMessage);
    }
  }, [isOpen, defaultMessage]);

  // Fechar emoji picker ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showEmojiPicker]);

  const loadSavedMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_call_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (!error && data) {
        setSavedMessages(data);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens salvas:', error);
    }
  };

  const handleSaveMessage = async () => {
    if (!message.trim()) return;
    
    try {
      const { error } = await supabase
        .from('saved_call_messages')
        .insert({ content: message.trim() });
      
      if (!error) {
        await loadSavedMessages();
        alert('Mensagem salva com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao salvar mensagem:', error);
      alert('Erro ao salvar mensagem');
    }
  };

  const handleSelectMessage = (content: string) => {
    setMessage(content);
    setShowSavedMessages(false);
    textareaRef.current?.focus();
  };

  const handleEditMessage = (msg: SavedMessage) => {
    setEditingMessageId(msg.id);
    setEditingContent(msg.content);
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editingContent.trim()) return;
    
    try {
      const { error } = await supabase
        .from('saved_call_messages')
        .update({ content: editingContent.trim() })
        .eq('id', editingMessageId);
      
      if (!error) {
        await loadSavedMessages();
        setEditingMessageId(null);
        setEditingContent('');
      }
    } catch (error) {
      console.error('Erro ao editar mensagem:', error);
    }
  };

  const handleDeleteMessage = async (id: number) => {
    if (!confirm('Deseja realmente excluir esta mensagem?')) return;
    
    try {
      const { error } = await supabase
        .from('saved_call_messages')
        .delete()
        .eq('id', id);
      
      if (!error) {
        await loadSavedMessages();
      }
    } catch (error) {
      console.error('Erro ao deletar mensagem:', error);
    }
  };

  // Gravação de áudio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Erro ao acessar microfone:', error);
      alert('Permissão de microfone negada ou dispositivo indisponível.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    setRecordingDuration(0);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSend = async () => {
    if (!message.trim() && !audioBlob) return;
    
    await onSend(message.trim(), audioBlob || undefined);
    
    // Limpar após enviar
    setMessage(defaultMessage);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  };

  const handleEmojiClick = (emojiData: any) => {
    const emoji = emojiData.emoji;
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = message.substring(0, start) + emoji + message.substring(end);
      setMessage(text);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    }
    setShowEmojiPicker(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-hidden" onClick={onClose}>
      <div 
        className="bg-white dark:bg-[#202c33] w-full max-w-md rounded-3xl shadow-2xl overflow-visible animate-fade-in-up relative" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-rose-50 dark:bg-rose-900/20 p-6 border-b border-rose-100 dark:border-rose-900/30">
          <h3 className="font-bold text-xl text-rose-800 dark:text-rose-300 flex items-center gap-2">
            <Send className="w-6 h-6"/> {title}
          </h3>
          {subtitle && (
            <p className="text-rose-600 dark:text-rose-400 text-sm mt-1">{subtitle}</p>
          )}
        </div>

        <div className="p-6">
          <label className="block text-xs font-bold text-slate-400 dark:text-gray-500 uppercase mb-2">
            Mensagem do Painel / WhatsApp
          </label>

          {/* Área de mensagem de texto */}
          <div className="relative mb-4">
            <textarea
              ref={textareaRef}
              className="w-full p-3 pr-20 bg-slate-50 dark:bg-[#111b21] rounded-xl border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-200 focus:outline-none focus:border-rose-400 resize-none"
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              placeholder="Digite sua mensagem..."
            />
            
            {/* Botões de ação no textarea */}
            <div className="absolute bottom-2 right-2 flex gap-1 z-10">
              <button
                type="button"
                onClick={() => {
                  setShowEmojiPicker(!showEmojiPicker);
                  if (showSavedMessages) setShowSavedMessages(false);
                }}
                className={`p-1.5 hover:bg-slate-200 dark:hover:bg-gray-700 rounded-lg transition-colors ${
                  showEmojiPicker ? 'bg-slate-200 dark:bg-gray-700' : ''
                }`}
                title="Emojis"
              >
                <Smile className="w-4 h-4 text-slate-500 dark:text-gray-400" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSavedMessages(!showSavedMessages);
                  if (showEmojiPicker) setShowEmojiPicker(false);
                }}
                className={`p-1.5 hover:bg-slate-200 dark:hover:bg-gray-700 rounded-lg transition-colors ${
                  showSavedMessages ? 'bg-slate-200 dark:bg-gray-700' : ''
                }`}
                title="Mensagens salvas"
              >
                <Paperclip className="w-4 h-4 text-slate-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Emoji Picker - Posicionado de forma responsiva */}
            {showEmojiPicker && (
              <div 
                ref={pickerRef} 
                className="fixed md:absolute bottom-20 md:bottom-full right-4 md:right-0 top-auto md:top-auto mb-0 md:mb-2 z-[60] rounded-xl shadow-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1e2028] overflow-hidden"
                style={{
                  maxWidth: 'min(350px, calc(100vw - 2rem))',
                  width: 'min(350px, calc(100vw - 2rem))',
                  maxHeight: 'min(400px, calc(100vh - 12rem))',
                  height: 'min(400px, calc(100vh - 12rem))'
                }}
              >
                <div className="relative w-full h-full" style={{ maxHeight: '100%', overflow: 'auto' }}>
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    emojiStyle={EmojiStyle.NATIVE}
                    theme={Theme.AUTO}
                    width={350}
                    height={400}
                    previewConfig={{
                      showPreview: false
                    }}
                    skinTonesDisabled
                    searchDisabled={false}
                  />
                </div>
              </div>
            )}

            {/* Lista de mensagens salvas - Posicionado de forma responsiva */}
            {showSavedMessages && (
              <div 
                className="fixed md:absolute bottom-20 md:bottom-full right-4 md:right-0 top-auto md:top-auto mb-0 md:mb-2 z-[60] bg-white dark:bg-[#1e2028] rounded-xl shadow-xl border border-slate-200 dark:border-gray-700 overflow-y-auto"
                style={{
                  width: 'min(320px, calc(100vw - 2rem))',
                  maxHeight: 'min(256px, calc(100vh - 12rem))'
                }}
              >
                <div className="p-3 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700 dark:text-gray-300">Mensagens Salvas</span>
                  <button
                    onClick={() => setShowSavedMessages(false)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-gray-700 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-2">
                  {savedMessages.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-gray-500 text-center py-4">
                      Nenhuma mensagem salva
                    </p>
                  ) : (
                    savedMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className="p-2 hover:bg-slate-50 dark:hover:bg-gray-700/50 rounded-lg mb-1 group"
                      >
                        {editingMessageId === msg.id ? (
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={editingContent}
                              onChange={e => setEditingContent(e.target.value)}
                              className="flex-1 text-xs p-1.5 bg-slate-100 dark:bg-gray-800 rounded border border-slate-200 dark:border-gray-700"
                              autoFocus
                            />
                            <button
                              onClick={handleSaveEdit}
                              className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                            >
                              <Check className="w-3 h-3 text-green-600" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingMessageId(null);
                                setEditingContent('');
                              }}
                              className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                            >
                              <X className="w-3 h-3 text-red-600" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <p
                              className="text-xs text-slate-700 dark:text-gray-300 cursor-pointer mb-1"
                              onClick={() => handleSelectMessage(msg.content)}
                            >
                              {msg.content}
                            </p>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleEditMessage(msg)}
                                className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"
                                title="Editar"
                              >
                                <Edit2 className="w-3 h-3 text-blue-600" />
                              </button>
                              <button
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                                title="Excluir"
                              >
                                <Trash2 className="w-3 h-3 text-red-600" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Área de áudio */}
          {audioUrl && (
            <div className="mb-4 p-3 bg-slate-50 dark:bg-[#111b21] rounded-xl border border-slate-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center">
                  <Mic className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-gray-300">Áudio gravado</p>
                  <p className="text-xs text-slate-500 dark:text-gray-400">{formatDuration(recordingDuration)}</p>
                </div>
              </div>
              <button
                onClick={cancelRecording}
                className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
              >
                <X className="w-4 h-4 text-red-600" />
              </button>
            </div>
          )}

          {/* Botões de ação */}
          <div className="flex gap-2 mb-4">
            {/* Botão de gravar áudio */}
            {!isRecording && !audioBlob && (
              <button
                type="button"
                onClick={startRecording}
                className="px-4 py-2 bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-xl font-medium text-sm hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
              >
                <Mic className="w-4 h-4" />
                Gravar Áudio
              </button>
            )}

            {/* Botão de parar gravação */}
            {isRecording && (
              <button
                type="button"
                onClick={stopRecording}
                className="px-4 py-2 bg-red-500 text-white rounded-xl font-medium text-sm hover:bg-red-600 transition-colors flex items-center gap-2 animate-pulse"
              >
                <div className="w-2 h-2 bg-white rounded-full" />
                Parar ({formatDuration(recordingDuration)})
              </button>
            )}

            {/* Botão de salvar mensagem */}
            {message.trim() && (
              <button
                type="button"
                onClick={handleSaveMessage}
                className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-xl font-medium text-sm hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-2"
                title="Salvar mensagem como padrão"
              >
                <Save className="w-4 h-4" />
                Salvar
              </button>
            )}
          </div>

          {/* Botões de ação principal */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-3 text-slate-500 dark:text-gray-400 font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              onClick={handleSend}
              disabled={isLoading || (!message.trim() && !audioBlob)}
              className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700 shadow-md shadow-rose-200 dark:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar e Chamar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
