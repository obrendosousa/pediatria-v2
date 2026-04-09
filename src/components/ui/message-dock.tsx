"use client";

import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect, useCallback } from "react";

export interface Character {
  id?: string | number;
  emoji?: string;
  name: string;
  online: boolean;
  backgroundColor?: string;
  gradientColors?: string;
  avatar?: string;
}

export interface MessageDockProps {
  characters?: Character[];
  onMessageSend?: (message: string, character: Character, characterIndex: number) => void;
  onCharacterSelect?: (character: Character, characterIndex: number) => void;
  onMenuClick?: () => void;
  className?: string;
  expandedWidth?: number;
  placeholder?: (characterName: string) => string;
  theme?: "light" | "dark" | "auto";
  autoFocus?: boolean;
  closeOnSend?: boolean;
  unreadCount?: number;
}

const getGradientColors = (character: Character) => {
  return character.gradientColors || "#86efac, #dcfce7";
};

export function MessageDock({
  characters = [],
  onMessageSend,
  onCharacterSelect,
  onMenuClick,
  className,
  expandedWidth = 360,
  placeholder = (name: string) => `Enviar mensagem para ${name}...`,
  theme = "light",
  autoFocus = true,
  closeOnSend = true,
  unreadCount = 0,
}: MessageDockProps) {
  // Track expanded by character ID, not index — stable across reorders
  const [expandedId, setExpandedId] = useState<string | number | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const dockRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dockRef.current && !dockRef.current.contains(e.target as Node)) {
        setExpandedId(null);
        setMessageInput("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const expandedIndex = expandedId !== null ? characters.findIndex(c => (c.id ?? c.name) === expandedId) : -1;
  const selectedCharacter = expandedIndex >= 0 ? characters[expandedIndex] : null;
  const isExpanded = selectedCharacter !== null;

  const handleCharacterClick = useCallback((character: Character, index: number) => {
    const charKey = character.id ?? character.name;
    if (expandedId === charKey) {
      setExpandedId(null);
      setMessageInput("");
    } else {
      setExpandedId(charKey);
      onCharacterSelect?.(character, index);
    }
  }, [expandedId, onCharacterSelect]);

  const handleSendMessage = useCallback(() => {
    if (messageInput.trim() && selectedCharacter && expandedIndex >= 0) {
      onMessageSend?.(messageInput, selectedCharacter, expandedIndex);
      setMessageInput("");
      if (closeOnSend) setExpandedId(null);
    }
  }, [messageInput, selectedCharacter, expandedIndex, onMessageSend, closeOnSend]);

  const isDark = theme === "dark";

  return (
    <div ref={dockRef} className={cn("relative z-50", className)}>
      <div
        className={cn(
          "rounded-full px-2.5 py-1.5 shadow-sm border",
          isDark ? "border-white/10" : "border-gray-200/60"
        )}
        style={{
          width: isExpanded ? expandedWidth : undefined,
          background: isExpanded && selectedCharacter
            ? `linear-gradient(to right, ${getGradientColors(selectedCharacter)})`
            : isDark ? "#1f2937" : "#ffffff",
          transition: "width 250ms ease-out, background 200ms ease-out",
        }}
      >
        <div className="flex items-center gap-1.5 relative h-7">
          {/* Avatars */}
          {characters.map((character, index) => {
            const charKey = character.id ?? character.name;
            const isSelected = expandedId === charKey;

            return (
              <div
                key={charKey}
                className={cn(
                  "relative shrink-0 transition-all duration-200 ease-out",
                  isExpanded && !isSelected && "opacity-0 scale-75 pointer-events-none w-0 -ml-1.5",
                  isExpanded && isSelected && "z-20",
                )}
                style={{ overflow: "visible" }}
              >
                <button
                  className={cn(
                    "relative w-7 h-7 rounded-full flex items-center justify-center cursor-pointer overflow-hidden",
                    isSelected && isExpanded && "ring-2 ring-white/50",
                    !character.avatar && (character.backgroundColor || "bg-gray-200 dark:bg-gray-700"),
                    "hover:brightness-110"
                  )}
                  onClick={() => handleCharacterClick(character, index)}
                  title={character.name}
                  aria-label={`Mensagem para ${character.name}`}
                >
                  {character.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={character.avatar} alt={character.name} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <span className="text-xs font-semibold text-white select-none">{character.emoji || character.name[0]}</span>
                  )}
                </button>

                {/* Status dot */}
                <span
                  className={cn(
                    "absolute bottom-0 right-0 w-2 h-2 rounded-full border-[1.5px] border-white dark:border-gray-800 z-10 pointer-events-none transition-all duration-200",
                    character.online ? "bg-emerald-400" : "bg-slate-300 dark:bg-slate-500",
                    isExpanded && !isSelected && "scale-0",
                  )}
                />
              </div>
            );
          })}

          {/* Message input */}
          <AnimatePresence>
            {isExpanded && (
              <motion.input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendMessage();
                  if (e.key === "Escape") {
                    setExpandedId(null);
                    setMessageInput("");
                  }
                }}
                placeholder={placeholder(selectedCharacter?.name || "")}
                className={cn(
                  "w-[220px] absolute left-9 right-0 bg-transparent border-none outline-none text-xs font-medium z-50",
                  isDark ? "text-gray-100 placeholder-gray-400" : "text-gray-700 placeholder-gray-500"
                )}
                autoFocus={autoFocus}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: 0.1, duration: 0.15 } }}
                exit={{ opacity: 0, transition: { duration: 0.08 } }}
              />
            )}
          </AnimatePresence>

          {/* Separator */}
          {!isExpanded && (
            <div className={cn("w-px h-5 mx-0.5 shrink-0", isDark ? "bg-gray-600" : "bg-gray-200")} />
          )}

          {/* Menu / Send button */}
          <div className={cn("shrink-0 z-20", isExpanded && "absolute right-0")}>
            {!isExpanded ? (
              <button
                className="relative w-7 h-7 flex items-center justify-center cursor-pointer rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                onClick={onMenuClick}
                aria-label="Abrir Chat"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isDark ? "text-gray-300" : "text-gray-500"}>
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="18" x2="20" y2="18" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            ) : (
              <button
                onClick={handleSendMessage}
                disabled={!messageInput.trim()}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-white/90 hover:bg-white transition-colors disabled:opacity-40 cursor-pointer"
                aria-label="Enviar mensagem"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-600">
                  <path d="m22 2-7 20-4-9-9-4z" />
                  <path d="M22 2 11 13" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
