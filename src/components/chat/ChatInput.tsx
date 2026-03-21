'use client';

 
import { useState, useRef, useEffect } from 'react';
import { Send, Mic, Paperclip, X, Smile, Trash2, Sparkles, Loader2, Upload, ClipboardList } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendButtonVariants } from '@/lib/animations';
import dynamic from 'next/dynamic';
import { EmojiStyle, Theme } from 'emoji-picker-react';
const EmojiPicker = dynamic(() => import('emoji-picker-react').then(mod => mod.default), {
  ssr: false,
  loading: () => <div className="w-[350px] h-[400px] bg-[var(--chat-surface)] rounded-xl animate-pulse" />,
});
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/contexts/ToastContext';

interface MessageMetadata {
  replyTo?: ChatMessage | null;
  editingMessage?: ChatMessage | null;
}

interface ChatMessage {
  id: string;
  message_text?: string;
  sender?: string;
  sender_name?: string;
  message_type?: string;
}

interface ChatInputProps {
  onSendMessage: (text: string, type: string, file?: File, metadata?: MessageMetadata) => Promise<void> | void;
  onSendAudio: (blob: Blob, duration: number) => void;
  onSendMedia: (file: File) => void;
  onFileDropped?: (files: File[]) => void;
  onTyping: (isTyping: boolean) => void;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  editingMessage?: ChatMessage | null;
  onCancelEdit?: () => void;
  isRecordingProp?: boolean;
  // Copiloto
  hasSuggestion?: boolean;
  isLoadingAISuggestion?: boolean;
  onRequestAISuggestion?: () => void;
  // Stickers
  onSendSticker?: (url: string) => void;
  // Modo plano (Clara)
  isClaraChat?: boolean;
}

export default function ChatInput({
  onSendMessage,
  onSendAudio,
  onSendMedia,
  onFileDropped,
  onTyping,
  replyTo,
  onCancelReply,
  editingMessage = null,
  onCancelEdit = () => { },
  hasSuggestion = false,
  isLoadingAISuggestion = false,
  onRequestAISuggestion,
  onSendSticker,
  isClaraChat = false,
}: ChatInputProps) {
  const { toast } = useToast();
  // --- ESTADOS ---
  const [message, setMessage] = useState('');
  const [planMode, setPlanMode] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState<'emojis' | 'stickers'>(() => {
    if (typeof window === 'undefined') return 'emojis';
    return (localStorage.getItem('pickerTab') as 'emojis' | 'stickers') || 'emojis';
  });
  const [savedStickers, setSavedStickers] = useState<Array<{ id: number; url: string }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  // Estados de Gravação
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  // --- REFS ---
  const inputRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const durationRef = useRef(0);

  // Fecha o picker se clicar fora dele
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- FIGURINHAS SALVAS (fetch via callback, não setState direto no effect) ---
  useEffect(() => {
    if (!showEmojiPicker || pickerTab !== 'stickers') return;
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from('saved_stickers')
      .select('id, url')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (!cancelled) setSavedStickers(error ? [] : (data || []));
      });
    return () => { cancelled = true; };
  }, [showEmojiPicker, pickerTab]);

  const handleDeleteSavedSticker = async (id: number) => {
    const supabase = createClient();
    const { error } = await supabase.from('saved_stickers').delete().eq('id', id);
    if (!error) {
      setSavedStickers(prev => prev.filter(s => s.id !== id));
    }
  };

  // --- LÓGICA DE ÁUDIO ---
  const recordingCancelledRef = useRef(false);
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        if (recordingCancelledRef.current) {
          recordingCancelledRef.current = false;
          return;
        }
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        onSendAudio(audioBlob, durationRef.current);
        setRecordingDuration(0);
        durationRef.current = 0;
        stream.getTracks().forEach(track => track.stop());
      };

      recordingCancelledRef.current = false;
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingDuration(0);
      durationRef.current = 0;

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          const newVal = prev + 1;
          durationRef.current = newVal;
          return newVal;
        });
      }, 1000);

    } catch (error) {
      console.error('Erro ao acessar microfone:', error);
      toast.error('Permissão de microfone negada ou dispositivo indisponível.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorder && isRecording) {
      recordingCancelledRef.current = true;
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingDuration(0);
      durationRef.current = 0;
    }
  };

  // --- LÓGICA DE TEXTO E HTML ---
  const getTextFromHtml = () => {
    if (!inputRef.current) return '';
    const clone = inputRef.current.cloneNode(true) as HTMLElement;
    const images = clone.getElementsByTagName('img');
    while (images.length > 0) {
      const img = images[0];
      const emojiChar = img.getAttribute('data-emoji') || '';
      const textNode = document.createTextNode(emojiChar);
      img.parentNode?.replaceChild(textNode, img);
    }
    return clone.innerText.trim();
  };

  const handleInput = () => {
    const text = getTextFromHtml();
    setMessage(text);
    onTyping(true);
  };

  const handleSend = () => {
    const text = getTextFromHtml();
    if (text) {
      const finalText = planMode ? `[PLANEJAR] ${text}` : text;
      onSendMessage(finalText, 'text', undefined, { replyTo, editingMessage });
      setMessage('');
      if (inputRef.current) inputRef.current.innerHTML = '';
      setShowEmojiPicker(false);
      if (planMode) setPlanMode(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) {
      if (onFileDropped) {
        onFileDropped(selected);
      } else {
        selected.forEach((f) => onSendMedia(f));
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- COLAR (CTRL+V) — intercepta imagens/vídeos do clipboard (múltiplas) ---
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const pastedFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
        const file = item.getAsFile();
        if (file) pastedFiles.push(file);
      }
    }

    if (pastedFiles.length > 0) {
      e.preventDefault();
      if (onFileDropped) {
        onFileDropped(pastedFiles);
      } else {
        pastedFiles.forEach((f) => onSendMedia(f));
      }
      return;
    }

    // Para colar texto: intercepta HTML e cola apenas texto puro
    const html = e.clipboardData.getData('text/html');
    if (html) {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      if (text) {
        document.execCommand('insertText', false, text);
      }
      return;
    }
  };

  const insertHtmlAtCursor = (html: string) => {
    const sel = window.getSelection();
    let range: Range | null = null;

    if (sel && sel.rangeCount > 0) {
      const currentRange = sel.getRangeAt(0);
      if (inputRef.current && inputRef.current.contains(currentRange.commonAncestorContainer)) {
        range = currentRange;
      }
    }

    if (!range && inputRef.current) {
      inputRef.current.focus();
      range = document.createRange();
      range.selectNodeContents(inputRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }

    if (range) {
      range.deleteContents();
      const el = document.createElement("div");
      el.innerHTML = html;
      const frag = document.createDocumentFragment();
      let node, lastNode;
      while ((node = el.firstChild)) {
        lastNode = frag.appendChild(node);
      }
      range.insertNode(frag);
      if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
    handleInput();
  };

  const onEmojiClick = (emojiData: { unified: string; emoji: string }) => {
    const unified = emojiData.unified;
    const url = `https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${unified}.png`;
    const imgTag = `<img src="${url}" data-emoji="${emojiData.emoji}" alt="${emojiData.emoji}" class="inline-block w-[20px] h-[20px] align-bottom select-none pointer-events-none mx-0.5 align-text-bottom" style="vertical-align: sub;" />`;
    insertHtmlAtCursor(imgTag);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!editingMessage || !inputRef.current) return;
    const newText = String(editingMessage.message_text || '');
    inputRef.current.innerText = newText;
    requestAnimationFrame(() => {
      setMessage(newText);
      inputRef.current?.focus();
    });
  }, [editingMessage]);

  // --- DRAG AND DROP ---
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (droppedFiles.length > 0) {
      if (onFileDropped) {
        onFileDropped(droppedFiles);
      } else {
        droppedFiles.forEach((f) => onSendMedia(f));
      }
    }
  };

  // --- RENDERIZAÇÃO ---
  if (isRecording) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="h-[62px] px-4 flex items-center gap-4 bg-[var(--chat-surface)] transition-colors duration-200"
      >
        <div className="flex items-center gap-2 text-red-500">
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="w-3 h-3 rounded-full bg-red-500"
          />
          <span className="font-medium tabular-nums text-lg">{formatTime(recordingDuration)}</span>
        </div>

        <div className="flex-1 text-sm text-[var(--chat-text-muted)] text-center">
          Gravando áudio...
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={cancelRecording}
            className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full text-[var(--chat-text-muted)] transition-colors duration-200 cursor-pointer"
            title="Cancelar"
          >
            <Trash2 size={20} />
          </button>
          <button
            onClick={stopRecording}
            className="p-3 bg-[var(--chat-accent)] hover:bg-[var(--chat-accent-hover)] rounded-full text-white transition-all duration-200 shadow-sm cursor-pointer"
            title="Enviar Áudio"
          >
            <Send size={20} />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col bg-[var(--chat-surface)] relative z-20 transition-colors duration-200"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Overlay de drag-and-drop estilo WhatsApp */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-sm pointer-events-none"
            style={{ background: 'color-mix(in srgb, var(--chat-accent) 12%, transparent)', border: '2px dashed var(--chat-accent)' }}
          >
            <Upload size={28} className="text-[var(--chat-accent)] mb-2" />
            <span className="text-[var(--chat-accent)] font-semibold text-sm">Solte para enviar</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-[62px] px-2 py-2 flex items-end gap-2">

        <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            ref={pickerRef}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-[70px] left-2 right-2 sm:right-auto z-50 shadow-2xl rounded-2xl bg-white dark:bg-[var(--chat-surface)] border border-gray-200 dark:border-[#3d3d48] overflow-hidden sm:w-[360px] flex flex-col"
          >
            {/* Conteúdo */}
            <div className="flex-1 min-h-0">
              {pickerTab === 'emojis' ? (
                <EmojiPicker
                  onEmojiClick={onEmojiClick}
                  autoFocusSearch={false}
                  theme={Theme.AUTO}
                  emojiStyle={EmojiStyle.APPLE}
                  searchDisabled={false}
                  width="100%"
                  height={440}
                  previewConfig={{ showPreview: false }}
                  lazyLoadEmojis={true}
                />
              ) : (
                <div className="h-[440px] overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                  {savedStickers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-4">
                      <Smile size={32} className="text-[var(--chat-text-muted)] opacity-50 mb-2" />
                      <p className="text-sm text-[var(--chat-text-muted)]">Nenhuma figurinha salva</p>
                      <p className="text-xs text-[var(--chat-text-muted)] opacity-70 mt-1">
                        Passe o mouse sobre uma figurinha recebida e clique na seta para salvar
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-5 gap-2">
                      {savedStickers.map((sticker) => (
                        <div key={sticker.id} className="relative group">
                          <button
                            onClick={() => { onSendSticker?.(sticker.url); setShowEmojiPicker(false); }}
                            className="w-full aspect-square rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors duration-200 p-1 flex items-center justify-center cursor-pointer"
                            title="Enviar figurinha"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={sticker.url} alt="Figurinha" className="w-full h-full object-contain" loading="lazy" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteSavedSticker(sticker.id); }}
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center shadow-sm cursor-pointer"
                            title="Remover figurinha"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tab bar inferior estilo WhatsApp */}
            <div className="flex items-center border-t border-gray-200 dark:border-[#3d3d48] bg-white dark:bg-[var(--chat-surface)]">
              <button
                onClick={() => { setPickerTab('emojis'); localStorage.setItem('pickerTab', 'emojis'); }}
                className={`flex-1 flex items-center justify-center py-2.5 transition-colors duration-200 cursor-pointer relative ${pickerTab === 'emojis' ? 'text-[var(--chat-accent)]' : 'text-[var(--chat-text-muted)] hover:text-[var(--chat-text-primary)]'}`}
              >
                <Smile size={22} />
                {pickerTab === 'emojis' && <span className="absolute bottom-0 left-1/4 right-1/4 h-[3px] rounded-t-full bg-[var(--chat-accent)]" />}
              </button>
              <button
                onClick={() => { setPickerTab('stickers'); localStorage.setItem('pickerTab', 'stickers'); }}
                className={`flex-1 flex items-center justify-center py-2.5 transition-colors duration-200 cursor-pointer relative ${pickerTab === 'stickers' ? 'text-[var(--chat-accent)]' : 'text-[var(--chat-text-muted)] hover:text-[var(--chat-text-primary)]'}`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M14 3v4a2 2 0 0 0 2 2h4"/><path d="M8 13h0"/><path d="M16 13h0"/><path d="M10 17c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/></svg>
                {pickerTab === 'stickers' && <span className="absolute bottom-0 left-1/4 right-1/4 h-[3px] rounded-t-full bg-[var(--chat-accent)]" />}
              </button>
            </div>
          </motion.div>
        )}
        </AnimatePresence>

        <div className="flex items-center gap-1 pb-2">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`p-2 rounded-full transition-colors duration-200 cursor-pointer ${showEmojiPicker ? 'text-[var(--chat-accent)] bg-[var(--chat-accent)]/10' : 'text-[var(--chat-text-muted)] hover:bg-gray-200 dark:hover:bg-white/10 hover:text-[var(--chat-accent)]'}`}
            title="Emojis e Figurinhas"
          >
            <Smile size={24} />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-[var(--chat-text-muted)] hover:bg-gray-200 dark:hover:bg-white/10 hover:text-[var(--chat-accent)] rounded-full transition-colors duration-200 cursor-pointer"
            title="Anexar arquivo"
          >
            <Paperclip size={24} className="rotate-45" />
          </button>

          {isClaraChat && (
            <button
              onClick={() => setPlanMode(!planMode)}
              className={`p-2 rounded-full transition-colors duration-200 cursor-pointer ${planMode ? 'text-amber-500 bg-amber-500/15' : 'text-[var(--chat-text-muted)] hover:bg-gray-200 dark:hover:bg-white/10 hover:text-amber-500'}`}
              title={planMode ? 'Modo plano ativo — Clara vai mostrar o plano antes de executar' : 'Ativar modo plano'}
            >
              <ClipboardList size={22} />
            </button>
          )}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            multiple
            accept="image/*,video/*,application/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar"
          />
        </div>

        <div className={`flex-1 bg-white dark:bg-[var(--chat-surface)] rounded-xl border transition-all duration-200 min-h-[42px] relative flex flex-col justify-center my-1 ${planMode ? 'border-amber-500/40 ring-1 ring-amber-500/20' : 'border-gray-200/60 dark:border-white/5 focus-within:border-[var(--chat-accent)]/30'}`}>
          <AnimatePresence>
          {planMode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20 rounded-t-xl text-xs text-amber-600 dark:text-amber-400"
            >
              <ClipboardList size={14} />
              <span className="font-medium">Modo plano</span>
              <span className="text-amber-500/70">Clara vai mostrar o plano antes de executar</span>
              <button onClick={() => setPlanMode(false)} className="ml-auto p-0.5 hover:bg-amber-500/20 rounded cursor-pointer">
                <X size={12} />
              </button>
            </motion.div>
          )}
          </AnimatePresence>
          <AnimatePresence>
          {(replyTo || editingMessage) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-0 right-0 bg-[var(--chat-surface)] p-2 rounded-t-lg border-l-4 border-[var(--chat-accent)] flex justify-between items-start mb-1 mx-1 shadow-sm opacity-95"
            >
              <div className="flex-1 min-w-0">
                {editingMessage ? (
                  <>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block mb-0.5">
                      Editando mensagem
                    </span>
                    <p className="text-xs text-[var(--chat-text-muted)] truncate">
                      {editingMessage.message_text}
                    </p>
                  </>
                ) : replyTo ? (
                  <>
                    <span className="text-xs font-bold text-[var(--chat-accent)] block mb-0.5">
                      {replyTo.sender === 'me' || replyTo.sender === 'HUMAN_AGENT' || replyTo.sender === 'AI_AGENT'
                        ? 'Você'
                        : (replyTo.sender === 'CUSTOMER' || replyTo.sender === 'contact') ? (replyTo.sender_name || 'Contato') : replyTo.sender || 'Contato'}
                    </span>
                    <p className="text-xs text-[var(--chat-text-muted)] truncate">
                      {replyTo.message_type === 'audio' || replyTo.message_type === 'voice'
                        ? '🎵 Áudio'
                        : replyTo.message_type === 'image'
                          ? '📷 Foto'
                          : replyTo.message_type === 'video'
                            ? '🎬 Vídeo'
                            : replyTo.message_type === 'document'
                              ? '📄 Documento'
                              : replyTo.message_type === 'sticker'
                                ? '💟 Figurinha'
                                : replyTo.message_text}
                    </p>
                  </>
                ) : null}
              </div>
              <button onClick={editingMessage ? onCancelEdit : onCancelReply} className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded cursor-pointer">
                <X size={14} className="text-[var(--chat-text-muted)]" />
              </button>
            </motion.div>
          )}
          </AnimatePresence>

          <style dangerouslySetInnerHTML={{ __html: `
            .custom-input:empty:before {
                content: attr(data-placeholder);
                color: var(--chat-text-muted);
                pointer-events: none;
                display: block;
            }
          `}} />

          <div
            ref={inputRef}
            contentEditable
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            role="textbox"
            data-placeholder={editingMessage ? 'Edite sua mensagem' : 'Digite uma mensagem'}
            className="custom-input w-full px-4 py-3 bg-transparent outline-none max-h-[120px] overflow-y-auto text-[15px] text-[var(--chat-text-primary)] leading-5 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 whitespace-pre-wrap break-words"
            style={{ minHeight: '44px' }}
          />
        </div>

        <div className="pb-2 pl-1 flex items-center gap-1">
          {/* Botão Copiloto */}
          {onRequestAISuggestion && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onRequestAISuggestion}
              disabled={isLoadingAISuggestion}
              title={isLoadingAISuggestion ? 'Gerando sugestão...' : 'Sugerir resposta com IA'}
              className={`p-2 rounded-full transition-all duration-200 cursor-pointer ${hasSuggestion
                ? 'text-[var(--chat-accent)] bg-[var(--chat-accent)]/15'
                : 'text-[var(--chat-text-muted)] hover:bg-gray-200 dark:hover:bg-white/10 hover:text-[var(--chat-accent)]'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {isLoadingAISuggestion
                ? <Loader2 size={18} className="animate-spin" />
                : <Sparkles size={18} />
              }
            </motion.button>
          )}

          <AnimatePresence mode="wait">
          {message.trim() ? (
            <motion.button
              key="send"
              variants={sendButtonVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleSend}
              className="p-3 bg-[var(--chat-accent)] hover:bg-[var(--chat-accent-hover)] text-white rounded-full transition-colors duration-200 shadow-md cursor-pointer"
            >
              <Send size={20} />
            </motion.button>
          ) : (
            <motion.button
              key="mic"
              variants={sendButtonVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              onClick={startRecording}
              className="p-3 bg-gray-200 dark:bg-white/5 hover:bg-[var(--chat-accent)]/20 text-[var(--chat-text-secondary)] hover:text-[var(--chat-accent)] rounded-full transition-colors duration-200 cursor-pointer"
              title="Gravar Áudio"
            >
              <Mic size={20} />
            </motion.button>
          )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
