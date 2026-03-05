'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Mic, Paperclip, X, Smile, Trash2, Sparkles, Loader2, Upload } from 'lucide-react';
import AIDraftBanner from './AIDraftBanner';
import AIDraftScheduleBanner from './AIDraftScheduleBanner';
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react';
import { useToast } from '@/contexts/ToastContext';

interface ChatInputProps {
  onSendMessage: (text: string, type: string, file?: File, metadata?: any) => Promise<void> | void;
  onSendAudio: (blob: Blob, duration: number) => void;
  onSendMedia: (file: File) => void;
  onFileDropped?: (file: File) => void;
  onTyping: (isTyping: boolean) => void;
  replyTo: any;
  onCancelReply: () => void;
  editingMessage?: any;
  onCancelEdit?: () => void;
  isRecordingProp?: boolean;
  // Copiloto
  aiDraftText?: string | null;
  aiDraftReason?: string | null;
  isLoadingAISuggestion?: boolean;
  onRequestAISuggestion?: () => void;
  onApproveAIDraft?: (text: string) => Promise<void>;
  onDiscardAIDraft?: () => Promise<void>;
  // Follow-up sugerido pela Clara
  aiDraftScheduleText?: string | null;
  aiDraftScheduleDate?: string | null;
  aiDraftScheduleReason?: string | null;
  onApproveScheduleDraft?: () => Promise<void>;
  onEditScheduleDraft?: () => void;
  onDiscardScheduleDraft?: () => Promise<void>;
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
  aiDraftText,
  aiDraftReason,
  isLoadingAISuggestion = false,
  onRequestAISuggestion,
  onApproveAIDraft,
  onDiscardAIDraft,
  aiDraftScheduleText,
  aiDraftScheduleDate,
  aiDraftScheduleReason,
  onApproveScheduleDraft,
  onEditScheduleDraft,
  onDiscardScheduleDraft,
}: ChatInputProps) {
  const { toast } = useToast();
  // --- ESTADOS ---
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
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

  // CORREÇÃO: Ref para manter o valor atualizado da duração dentro do callback do recorder
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

  // --- LÓGICA DE ÁUDIO ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        onSendAudio(audioBlob, durationRef.current);

        setRecordingDuration(0);
        durationRef.current = 0;
        stream.getTracks().forEach(track => track.stop());
      };

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
      toast.toast.error('Permissão de microfone negada ou dispositivo indisponível.');
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
      onSendMessage(text, 'text', undefined, { replyTo, editingMessage });
      setMessage('');
      if (inputRef.current) inputRef.current.innerHTML = '';
      setShowEmojiPicker(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Usa o callback de preview se disponível, senão envia direto
      if (onFileDropped) {
        onFileDropped(file);
      } else {
        onSendMedia(file);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- COLAR (CTRL+V) — intercepta imagens do clipboard ---
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        // Impede a imagem de colar dentro da caixa de texto
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          if (onFileDropped) {
            onFileDropped(file);
          } else {
            onSendMedia(file);
          }
        }
        return;
      }
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
    // Texto simples: deixa o comportamento padrão
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

  const onEmojiClick = (emojiData: any) => {
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
    setMessage(newText);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [editingMessage?.id]);

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

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (onFileDropped) {
        onFileDropped(file);
      } else {
        onSendMedia(file);
      }
    }
  };

  // --- RENDERIZAÇÃO ---
  if (isRecording) {
    return (
      <div className="h-[62px] px-4 flex items-center gap-4 bg-[var(--chat-surface)] dark:bg-[#202c33] border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-red-500 animate-pulse">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="font-medium tabular-nums text-lg">{formatTime(recordingDuration)}</span>
        </div>

        <div className="flex-1 text-sm text-gray-500 text-center">
          Gravando áudio...
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={cancelRecording}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500 transition-colors"
            title="Cancelar"
          >
            <Trash2 size={20} />
          </button>
          <button
            onClick={stopRecording}
            className="p-3 bg-[var(--chat-accent)] hover:bg-[var(--chat-accent-hover)] rounded-full text-white transition-colors shadow-sm animate-in zoom-in duration-200"
            title="Enviar Áudio"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col bg-[var(--chat-surface)] dark:bg-[#202c33] border-t border-gray-200 dark:border-gray-700 relative z-20"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Overlay de drag-and-drop estilo WhatsApp */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-sm pointer-events-none"
          style={{ background: 'color-mix(in srgb, var(--chat-accent) 12%, transparent)', border: '2px dashed var(--chat-accent)' }}>
          <Upload size={28} className="text-[var(--chat-accent)] mb-2" />
          <span className="text-[var(--chat-accent)] font-semibold text-sm">Solte para enviar</span>
        </div>
      )}

      {/* Balão flutuante de sugestão da IA */}
      {aiDraftText && onApproveAIDraft && onDiscardAIDraft && (
        <AIDraftBanner
          draftText={aiDraftText}
          draftReason={aiDraftReason || ''}
          onApprove={onApproveAIDraft}
          onDiscard={onDiscardAIDraft}
        />
      )}

      {/* Balão flutuante de follow-up agendado sugerido pela Clara */}
      {aiDraftScheduleText && onApproveScheduleDraft && onDiscardScheduleDraft && (
        <AIDraftScheduleBanner
          scheduleText={aiDraftScheduleText}
          scheduleDate={aiDraftScheduleDate || ''}
          scheduleReason={aiDraftScheduleReason || ''}
          onApprove={onApproveScheduleDraft}
          onEdit={onEditScheduleDraft || (() => {})}
          onDiscard={onDiscardScheduleDraft}
        />
      )}
      <div className="min-h-[62px] px-2 py-2 flex items-end gap-2">

        {showEmojiPicker && (
          <div ref={pickerRef} className="absolute bottom-[70px] left-2 z-50 shadow-2xl rounded-2xl animate-in slide-in-from-bottom-2 fade-in duration-200">
            <EmojiPicker
              onEmojiClick={onEmojiClick}
              autoFocusSearch={false}
              theme={Theme.AUTO}
              emojiStyle={EmojiStyle.APPLE}
              searchDisabled={false}
              width={320}
              height={400}
              previewConfig={{ showPreview: false }}
              lazyLoadEmojis={true}
            />
          </div>
        )}

        <div className="flex items-center gap-1 pb-2">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`p-2 rounded-full transition-colors ${showEmojiPicker ? 'text-[var(--chat-accent)] bg-[color-mix(in_srgb,var(--chat-accent)_10%,white)]' : 'text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700'}`}
            title="Emojis"
          >
            <Smile size={24} />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 rounded-full transition-colors"
            title="Anexar arquivo"
          >
            <Paperclip size={24} className="rotate-45" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,video/*,application/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar"
          />
        </div>

        <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg border border-transparent focus-within:border-[var(--chat-accent)]/50 transition-colors min-h-[42px] relative flex flex-col justify-center my-1">
          {(replyTo || editingMessage) && (
            <div className="absolute bottom-full left-0 right-0 bg-[var(--chat-surface)] dark:bg-[#1f2c34] p-2 rounded-t-lg border-l-4 border-[var(--chat-accent)] flex justify-between items-start mb-1 mx-1 shadow-sm opacity-95 animate-in slide-in-from-bottom-2">
              <div className="flex-1 min-w-0">
                {editingMessage ? (
                  <>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block mb-0.5">
                      Editando mensagem
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {editingMessage.message_text}
                    </p>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-bold text-[var(--chat-accent)] block mb-0.5">
                      {replyTo.sender === 'me' || replyTo.sender === 'HUMAN_AGENT' || replyTo.sender === 'AI_AGENT'
                        ? 'Você'
                        : (replyTo.sender === 'CUSTOMER' || replyTo.sender === 'contact') ? (replyTo.sender_name || 'Contato') : replyTo.sender || 'Contato'}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
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
                )}
              </div>
              <button onClick={editingMessage ? onCancelEdit : onCancelReply} className="p-1 hover:bg-black/5 rounded">
                <X size={14} className="text-gray-500" />
              </button>
            </div>
          )}

          <style jsx>{`
            .custom-input:empty:before {
                content: attr(data-placeholder);
                color: var(--chat-text-muted);
                pointer-events: none;
                display: block;
            }
        `}</style>

          <div
            ref={inputRef}
            contentEditable
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            role="textbox"
            data-placeholder={editingMessage ? 'Edite sua mensagem' : 'Digite uma mensagem'}
            className="custom-input w-full px-4 py-3 bg-transparent outline-none max-h-[120px] overflow-y-auto text-[15px] text-[var(--chat-text-primary)] dark:text-[#e9edef] leading-5 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 whitespace-pre-wrap break-words"
            style={{ minHeight: '44px' }}
          />
        </div>

        <div className="pb-2 pl-1 flex items-center gap-1">
          {/* Botão Copiloto */}
          {onRequestAISuggestion && (
            <button
              onClick={onRequestAISuggestion}
              disabled={isLoadingAISuggestion}
              title={isLoadingAISuggestion ? 'Gerando sugestão...' : 'Sugerir resposta com IA'}
              className={`p-2 rounded-full transition-all active:scale-95 ${aiDraftText
                ? 'text-purple-500 bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-800/50'
                : 'text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-purple-500'
                } disabled:opacity-40`}
            >
              {isLoadingAISuggestion
                ? <Loader2 size={18} className="animate-spin" />
                : <Sparkles size={18} />
              }
            </button>
          )}

          {message.trim() ? (
            <button
              onClick={handleSend}
              className="p-3 bg-[var(--chat-accent)] hover:bg-[var(--chat-accent-hover)] text-white rounded-full transition-all shadow-sm active:scale-95 animate-in zoom-in duration-200"
            >
              <Send size={20} />
            </button>
          ) : (
            <button
              onClick={startRecording}
              className="p-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full transition-all active:scale-95"
              title="Gravar Áudio"
            >
              <Mic size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
