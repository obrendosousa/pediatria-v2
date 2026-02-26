"use client";

import { FormEvent, Fragment, useEffect, useRef, useState } from "react";
import { BotMessageSquare, Loader2, SendHorizonal, Sparkles, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// MARKDOWN RENDERER LEVE (sem dependências externas)
// Suporta: headings, bold, italic, code inline, listas, hr, parágrafos
// ─────────────────────────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  // Divide por: `code`, **bold**, *italic*
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-[11px] font-mono text-violet-600 dark:text-violet-400">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function CopilotMarkdown({ content }: { content: string }) {
  const elements: React.ReactNode[] = [];
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    if (line.startsWith("### ")) {
      elements.push(
        <p key={i} className="font-semibold text-xs text-gray-700 dark:text-gray-300 mt-2 mb-0.5">
          {renderInline(line.slice(4))}
        </p>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <p key={i} className="font-bold text-xs text-gray-800 dark:text-gray-200 uppercase tracking-wide mt-2.5 mb-1">
          {renderInline(line.slice(3))}
        </p>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <p key={i} className="font-bold text-sm text-gray-900 dark:text-gray-100 mt-2 mb-1">
          {renderInline(line.slice(2))}
        </p>
      );

    // Linha horizontal
    } else if (/^[-*_]{3,}$/.test(line.trim())) {
      elements.push(<hr key={i} className="border-gray-200 dark:border-gray-600 my-2" />);

    // Lista não-ordenada
    } else if (/^[-*+]\s/.test(line)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        listItems.push(
          <li key={i} className="flex gap-1.5 items-start">
            <span className="text-violet-400 shrink-0 mt-0.5 leading-snug">•</span>
            <span>{renderInline(lines[i].replace(/^[-*+]\s/, ""))}</span>
          </li>
        );
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="space-y-0.5 my-1 ml-0.5">
          {listItems}
        </ul>
      );
      continue;

    // Lista ordenada
    } else if (/^\d+\.\s/.test(line)) {
      const listItems: React.ReactNode[] = [];
      let num = 1;
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        listItems.push(
          <li key={i} className="flex gap-1.5 items-start">
            <span className="text-violet-400 font-mono text-[11px] shrink-0 mt-0.5 min-w-[14px]">{num}.</span>
            <span>{renderInline(lines[i].replace(/^\d+\.\s/, ""))}</span>
          </li>
        );
        i++;
        num++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="space-y-0.5 my-1 ml-0.5">
          {listItems}
        </ol>
      );
      continue;

    // Linha vazia → espaçamento
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1" />);

    // Parágrafo normal
    } else {
      elements.push(
        <p key={i} className="leading-relaxed">
          {renderInline(line)}
        </p>
      );
    }

    i++;
  }

  return <div className="text-sm space-y-0.5">{elements}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────

type LocalMessage = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  "Resume esse caso pra mim",
  "Qual a objeção dele?",
  "Como posso responder à última mensagem?",
  "Ele já agendou antes?",
];

const MEMORY_LIMIT = 30;

interface CopilotChatProps {
  chatId: number;
  patientName: string;
}

export default function CopilotChat({ chatId, patientName }: CopilotChatProps) {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMemory, setIsLoadingMemory] = useState(false);
  const [uiLogs, setUiLogs] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Carrega memória persistente ao trocar de paciente
  useEffect(() => {
    if (!chatId) return;
    setMessages([]);
    setInput("");
    setUiLogs([]);
    setIsLoading(false);
    setIsLoadingMemory(true);

    supabase
      .from("copilot_memories" as any)
      .select("role, content")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true })
      .limit(MEMORY_LIMIT)
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          setMessages(
            (data as any[]).map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content as string,
            }))
          );
        }
        setIsLoadingMemory(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // Auto-scroll suave
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, uiLogs]);

  async function clearMemory() {
    if (!chatId) return;
    await (supabase as any).from("copilot_memories").delete().eq("chat_id", chatId);
    setMessages([]);
  }

  async function sendQuestion(question: string) {
    const clean = question.trim();
    if (!clean || isLoading) return;

    const historyToSend = messages.slice(-20);

    setMessages((prev) => [...prev, { role: "user", content: clean }]);
    setInput("");
    setUiLogs([]);
    setIsLoading(true);

    let fullResponse = "";

    try {
      const response = await fetch("/api/ai/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, message: clean, history: historyToSend }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Falha ao conectar com a Clara.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = "";

      // Slot vazio — será preenchido pelos chunks (não renderiza até ter conteúdo)
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.type === "ui_log") {
                setUiLogs((prev) => [...prev, parsed.content]);
              } else if (parsed.type === "chunk") {
                fullResponse += parsed.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === "assistant") {
                    updated[updated.length - 1] = { ...last, content: last.content + parsed.content };
                  }
                  return updated;
                });
              } else if (parsed.type === "error") {
                throw new Error(parsed.content);
              }
            } catch {
              // linha inválida — ignora
            }
          }
        }
      }

      // Persiste o par pergunta + resposta na memória isolada deste paciente
      if (fullResponse.trim()) {
        await (supabase as any).from("copilot_memories").insert([
          { chat_id: chatId, role: "user", content: clean },
          { chat_id: chatId, role: "assistant", content: fullResponse },
        ]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido.";
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setUiLogs([]);
      setIsLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    sendQuestion(input);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Cabeçalho */}
      <div className="px-4 py-3 bg-violet-50 dark:bg-violet-900/20 border-b border-violet-100 dark:border-violet-800 shrink-0">
        <div className="flex items-center justify-between">
          <p className="text-xs text-violet-600 dark:text-violet-300 font-medium flex items-center gap-1.5">
            <Sparkles size={12} />
            Contexto: <span className="font-bold truncate max-w-[160px]">{patientName}</span>
          </p>
          {messages.length > 0 && !isLoading && (
            <button
              onClick={clearMemory}
              title="Apagar memória deste paciente"
              className="text-violet-300 hover:text-red-400 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
        <p className="text-[10px] text-violet-400 dark:text-violet-500 mt-0.5">
          {isLoadingMemory
            ? "Carregando histórico..."
            : messages.length > 0
              ? `${messages.length} mensagens na memória`
              : "Perguntas sobre este paciente ficam aqui."}
        </p>
      </div>

      {/* Área de mensagens */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">

        {/* Carregamento da memória */}
        {isLoadingMemory && (
          <div className="flex justify-center py-8">
            <div className="flex items-center gap-2 text-violet-400 text-xs">
              <Loader2 size={14} className="animate-spin" />
              Carregando memória do paciente...
            </div>
          </div>
        )}

        {/* Sugestões */}
        {!isLoadingMemory && messages.length === 0 && !isLoading && (
          <div className="space-y-2 pt-2">
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mb-3">Sugestões rápidas</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendQuestion(s)}
                className="w-full text-left text-xs px-3 py-2 rounded-lg border border-violet-100 dark:border-violet-800 bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-300 hover:bg-violet-50 dark:hover:bg-violet-900/30 hover:border-violet-300 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Mensagens */}
        {messages.map((msg, i) => {
          // ─── FIX: não renderiza o slot vazio enquanto a IA ainda não produziu nenhum token
          if (msg.role === "assistant" && !msg.content && isLoading) return null;

          return (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[88%] rounded-2xl px-3 py-2.5 ${
                  msg.role === "user"
                    ? "bg-violet-600 text-white text-sm leading-relaxed rounded-br-sm"
                    : "bg-white dark:bg-[#2a2d36] text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-bl-sm shadow-sm"
                }`}
              >
                {msg.role === "assistant" ? (
                  <CopilotMarkdown content={msg.content} />
                ) : (
                  msg.content
                )}
              </div>
            </div>
          );
        })}

        {/* Painel de logs/pensamento da IA — aparece enquanto processa */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800 rounded-xl px-3 py-2 max-w-[88%]">
              {uiLogs.length > 0 ? (
                uiLogs.map((log, i) => (
                  <p key={i} className="text-[11px] text-violet-500 dark:text-violet-400 flex items-center gap-1.5">
                    <Loader2 size={10} className="animate-spin shrink-0" />
                    {log}
                  </p>
                ))
              ) : (
                <div className="flex items-center gap-1.5">
                  <BotMessageSquare size={13} className="text-violet-400 animate-pulse" />
                  <span className="text-[11px] text-violet-400">Clara está pensando...</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-3 py-3 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-[#202c33] shrink-0"
      >
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#2a2d36] border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 focus-within:border-violet-400 transition-colors">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading || isLoadingMemory}
            placeholder={`Pergunte sobre ${patientName}...`}
            className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || isLoadingMemory}
            className="text-violet-500 hover:text-violet-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Enviar"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <SendHorizonal size={16} />}
          </button>
        </div>
      </form>
    </div>
  );
}
