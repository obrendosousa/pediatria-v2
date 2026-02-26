"use client";

import { FormEvent, useMemo, useState, useRef, useEffect } from "react";
import { Loader2, SendHorizonal, Activity } from "lucide-react";

type LocalMessage = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  "Me traga um panorama de atendimentos dos últimos 7 dias.",
  "Liste chats estagnados há mais de 24h com sentimento negativo.",
  "Analise o chat ID 123 e explique por que não houve conversão.",
  "Busque conversas com a palavra 'cancelar' e resuma os padrões.",
];

export default function AnalystChat() {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Novo estado para armazenar os logs em tempo real ("Efeito Cursor")
  const [uiLogs, setUiLogs] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isLoading, [input, isLoading]);

  // Auto-scroll suave
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, uiLogs]);

  async function sendQuestion(question: string) {
    const cleanQuestion = question.trim();
    if (!cleanQuestion) return;

    setMessages((prev) => [...prev, { role: "user", content: cleanQuestion }]);
    setInput("");
    setError(null);
    setUiLogs([]); // Limpa os logs antigos
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/analyst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: cleanQuestion,
          history: messages,
        }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Falha ao conectar com o analista.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = ""; // Buffer para lidar com NDJSON quebrado no meio da rede

      // Prepara um slot vazio para a resposta da IA que será preenchido via stream
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");

          // Mantém o último pedaço (incompleto) no buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);

              if (data.type === "ui_log") {
                // Adiciona o log ao painel de pensamento
                setUiLogs((prev) => [...prev, data.content]);
              } else if (data.type === "chunk") {
                // Concatena a palavra na última mensagem (a do assistente)
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastIndex = newMessages.length - 1;
                  newMessages[lastIndex] = {
                    ...newMessages[lastIndex],
                    content: newMessages[lastIndex].content + data.content,
                  };
                  return newMessages;
                });
              } else if (data.type === "error") {
                setError(data.content);
              }
            } catch (parseError) {
              console.warn("Erro ao fazer parse do chunk JSON:", line);
            }
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado na consulta.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSend) return;
    void sendQuestion(input);
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-[#111b21] rounded-2xl border border-slate-200 dark:border-gray-800">
      <div className="border-b border-slate-200 dark:border-gray-800 p-4">
        <h1 className="text-lg font-bold text-slate-800 dark:text-gray-100">Analista de Atendimento</h1>
        <p className="text-sm text-slate-500 dark:text-gray-400">
          Faça análises profundas. A IA irá navegar nos bancos de dados para obter conclusões.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-gray-700 p-4">
            <p className="text-sm text-slate-600 dark:text-gray-300 mb-3">
              Exemplos de pesquisas em cadeia para começar:
            </p>
            <div className="space-y-2">
              {SUGGESTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => void sendQuestion(item)}
                  className="w-full rounded-lg border border-slate-200 dark:border-gray-700 px-3 py-2 text-left text-sm text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => {
          // Se for uma mensagem do assistente que está vazia, não a desenha ainda (espera o stream começar)
          if (message.role === "assistant" && !message.content && isLoading) return null;

          return (
            <div
              key={`${message.role}-${index}`}
              className={`max-w-3xl rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${message.role === "user"
                  ? "ml-auto bg-pink-500 text-white"
                  : "mr-auto bg-slate-100 text-slate-800 dark:bg-[#202c33] dark:text-gray-100"
                }`}
            >
              {message.content}
            </div>
          );
        })}

        {/* EFEITO CURSOR: UI LOGS DA IA PENSANDO */}
        {isLoading && uiLogs.length > 0 && (
          <div className="mr-auto w-full max-w-xl rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#1a2228] p-3 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">
              <Activity className="h-3 w-3 animate-pulse text-pink-500" />
              Linha de Raciocínio (Deep Research)
            </div>
            <ul className="space-y-1">
              {uiLogs.map((log, i) => (
                <li key={i} className="text-xs text-slate-600 dark:text-gray-300 flex items-start gap-2 animate-in fade-in slide-in-from-bottom-1">
                  <span className="text-slate-400 mt-[2px]">↳</span> {log}
                </li>
              ))}
              <li className="text-xs text-slate-400 dark:text-gray-500 flex items-center gap-2 mt-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Processando...
              </li>
            </ul>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-slate-200 dark:border-gray-800 p-4">
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}
        <form onSubmit={onSubmit} className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e as unknown as FormEvent);
              }
            }}
            placeholder="Peça para ela mapear padrões, analisar lotes de chats, encontrar objeções..."
            rows={2}
            className="flex-1 resize-none rounded-xl border border-slate-300 dark:border-gray-700 bg-white dark:bg-[#0f171d] px-3 py-2 text-sm text-slate-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-pink-400 transition-all"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-pink-500 px-4 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-pink-600 transition-colors"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}