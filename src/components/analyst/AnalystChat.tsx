"use client";

import { FormEvent, useMemo, useState } from "react";
import { Loader2, SendHorizonal } from "lucide-react";

type LocalMessage = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  "Me traga um panorama de atendimentos dos ultimos 7 dias.",
  "Liste chats estagnados ha mais de 24h com sentimento negativo.",
  "Analise o chat ID 123 e explique porque nao houve conversao.",
  "Busque conversas com a palavra 'cancelar' e resuma os padroes.",
];

export default function AnalystChat() {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isLoading, [input, isLoading]);

  async function sendQuestion(question: string) {
    const cleanQuestion = question.trim();
    if (!cleanQuestion) return;

    const nextMessages = [...messages, { role: "user" as const, content: cleanQuestion }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
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

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao consultar o analista.");
      }

      const answer = typeof payload?.answer === "string" ? payload.answer : "Sem resposta do analista.";
      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
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
          Faça perguntas sobre metricas, gargalos e casos especificos de chats.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-gray-700 p-4">
            <p className="text-sm text-slate-600 dark:text-gray-300 mb-3">
              Exemplos de perguntas para comecar:
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

        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`max-w-3xl rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${
              message.role === "user"
                ? "ml-auto bg-pink-500 text-white"
                : "mr-auto bg-slate-100 text-slate-800 dark:bg-[#202c33] dark:text-gray-100"
            }`}
          >
            {message.content}
          </div>
        ))}

        {isLoading && (
          <div className="mr-auto inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700 dark:bg-[#202c33] dark:text-gray-200">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analisando dados...
          </div>
        )}
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
            placeholder="Pergunte sobre desempenho do atendimento..."
            rows={3}
            className="flex-1 resize-none rounded-xl border border-slate-300 dark:border-gray-700 bg-white dark:bg-[#0f171d] px-3 py-2 text-sm text-slate-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-pink-400"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-pink-500 px-4 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-pink-600 transition-colors"
          >
            <SendHorizonal className="h-4 w-4" />
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
