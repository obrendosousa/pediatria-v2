"use client";

import { cn } from "@/lib/utils";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
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
  enableAnimations?: boolean;
  placeholder?: (characterName: string) => string;
  theme?: "light" | "dark" | "auto";
  autoFocus?: boolean;
  closeOnSend?: boolean;
  unreadCount?: number;
}

const defaultCharacters: Character[] = [
  { emoji: "🧙‍♂️", name: "Wizard", online: true, backgroundColor: "bg-green-300", gradientColors: "#86efac, #dcfce7" },
  { emoji: "🦄", name: "Unicorn", online: true, backgroundColor: "bg-purple-300", gradientColors: "#c084fc, #f3e8ff" },
  { emoji: "🐵", name: "Monkey", online: true, backgroundColor: "bg-yellow-300", gradientColors: "#fde047, #fefce8" },
];

const getGradientColors = (character: Character) => {
  return character.gradientColors || "#86efac, #dcfce7";
};

export function MessageDock({
  characters = defaultCharacters,
  onMessageSend,
  onCharacterSelect,
  onMenuClick,
  className,
  expandedWidth = 360,
  enableAnimations = true,
  placeholder = (name: string) => `Enviar mensagem para ${name}...`,
  theme = "light",
  autoFocus = true,
  closeOnSend = true,
  unreadCount = 0,
}: MessageDockProps) {
  const shouldReduceMotion = useReducedMotion();
  const [expandedCharacter, setExpandedCharacter] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const dockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dockRef.current && !dockRef.current.contains(event.target as Node)) {
        setExpandedCharacter(null);
        setMessageInput("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hoverAnimation = shouldReduceMotion
    ? { scale: 1.02 }
    : { scale: 1.15, y: -3, transition: { type: "spring" as const, stiffness: 400, damping: 25 } };

  const handleCharacterClick = useCallback((index: number) => {
    const character = characters[index];
    if (expandedCharacter === index) {
      setExpandedCharacter(null);
      setMessageInput("");
    } else {
      setExpandedCharacter(index);
      onCharacterSelect?.(character, index);
    }
  }, [characters, expandedCharacter, onCharacterSelect]);

  const handleSendMessage = useCallback(() => {
    if (messageInput.trim() && expandedCharacter !== null) {
      const character = characters[expandedCharacter];
      onMessageSend?.(messageInput, character, expandedCharacter);
      setMessageInput("");
      if (closeOnSend) {
        setExpandedCharacter(null);
      }
    }
  }, [messageInput, expandedCharacter, characters, onMessageSend, closeOnSend]);

  const selectedCharacter = expandedCharacter !== null ? characters[expandedCharacter] : null;
  const isExpanded = expandedCharacter !== null;
  const isDark = theme === "dark";

  return (
    <motion.div
      ref={dockRef}
      className={cn("relative z-50", className)}
      initial={enableAnimations ? { opacity: 0, scale: 0.9 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring" as const, stiffness: 300, damping: 30 }}
    >
      <motion.div
        className={cn(
          "rounded-full px-2.5 py-1.5 shadow-sm border",
          isDark ? "border-white/10" : "border-gray-200/60"
        )}
        animate={{
          width: isExpanded ? expandedWidth : "auto",
          background: isExpanded && selectedCharacter
            ? `linear-gradient(to right, ${getGradientColors(selectedCharacter)})`
            : isDark ? "#1f2937" : "#ffffff",
        }}
        transition={enableAnimations ? {
          type: "spring" as const,
          stiffness: 400,
          damping: 35,
          background: { duration: 0.2, ease: "easeInOut" as const },
        } : { duration: 0 }}
      >
        <div className="flex items-center gap-1.5 relative">
          {/* Character avatars */}
          {characters.map((character, index) => {
            const isSelected = expandedCharacter === index;
            return (
              <motion.div
                key={character.id ?? character.name}
                className={cn(
                  "relative",
                  isSelected && isExpanded && "absolute left-0 top-0 z-20"
                )}
                style={{
                  width: isSelected && isExpanded ? 0 : "auto",
                  minWidth: isSelected && isExpanded ? 0 : "auto",
                  overflow: "visible",
                }}
                animate={{
                  opacity: isExpanded && !isSelected ? 0 : 1,
                  y: isExpanded && !isSelected ? 40 : 0,
                  scale: isExpanded && !isSelected ? 0.8 : 1,
                }}
                transition={{
                  type: "spring" as const,
                  stiffness: 400,
                  damping: 30,
                  delay: isExpanded && !isSelected ? index * 0.03 : 0,
                }}
              >
                <motion.button
                  className={cn(
                    "relative w-7 h-7 rounded-full flex items-center justify-center cursor-pointer overflow-hidden",
                    isSelected && isExpanded ? "ring-2 ring-white/50" : "",
                    !character.avatar && (character.backgroundColor || "bg-gray-200 dark:bg-gray-700")
                  )}
                  onClick={() => handleCharacterClick(index)}
                  whileHover={!isExpanded ? hoverAnimation : { scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title={character.name}
                  aria-label={`Mensagem para ${character.name}`}
                >
                  {character.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={character.avatar} alt={character.name} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <span className="text-xs font-semibold text-white">{character.emoji || character.name[0]}</span>
                  )}

                  {character.online && (
                    <motion.div
                      className="absolute -bottom-px -right-px w-2 h-2 bg-emerald-400 border-[1.5px] border-white dark:border-gray-800 rounded-full"
                      initial={{ scale: 0 }}
                      animate={{ scale: isExpanded && !isSelected ? 0 : 1 }}
                      transition={{
                        delay: isExpanded ? (isSelected ? 0.3 : 0) : index * 0.08 + 0.3,
                        type: "spring" as const,
                        stiffness: 500,
                        damping: 30,
                      }}
                    />
                  )}
                </motion.button>

              </motion.div>
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
                    setExpandedCharacter(null);
                    setMessageInput("");
                  }
                }}
                placeholder={placeholder(selectedCharacter?.name || "")}
                className={cn(
                  "w-[220px] absolute left-9 right-0 bg-transparent border-none outline-none text-xs font-medium z-50",
                  isDark ? "text-gray-100 placeholder-gray-400" : "text-gray-700 placeholder-gray-500"
                )}
                autoFocus={autoFocus}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0, transition: { delay: 0.15, type: "spring" as const, stiffness: 400, damping: 30 } }}
                exit={{ opacity: 0, transition: { duration: 0.1, ease: "easeOut" as const } }}
              />
            )}
          </AnimatePresence>

          {/* Separator + Menu/Send */}
          {!isExpanded && (
            <motion.div
              className={cn("w-px h-5 mx-0.5", isDark ? "bg-gray-600" : "bg-gray-200")}
              animate={{ opacity: isExpanded ? 0 : 1, scaleY: isExpanded ? 0 : 1 }}
              transition={{ type: "spring" as const, stiffness: 300, damping: 30 }}
            />
          )}

          <motion.div
            className={cn("flex items-center justify-center z-20", isExpanded && "absolute right-0")}
          >
            <AnimatePresence mode="wait">
              {!isExpanded ? (
                <motion.button
                  key="menu"
                  className="relative w-7 h-7 flex items-center justify-center cursor-pointer rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                  onClick={onMenuClick}
                  whileTap={{ scale: 0.95 }}
                  aria-label="Abrir Chat"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ type: "spring" as const, stiffness: 400, damping: 30 }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isDark ? "text-gray-300" : "text-gray-500"}>
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="18" x2="20" y2="18" />
                  </svg>

                  {/* Unread badge */}
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </motion.button>
              ) : (
                <motion.button
                  key="send"
                  onClick={handleSendMessage}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-white/90 hover:bg-white transition-colors disabled:opacity-50 cursor-pointer"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  disabled={!messageInput.trim()}
                  initial={{ opacity: 0, scale: 0, rotate: -90 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0, transition: { delay: 0.2, type: "spring" as const, stiffness: 400, damping: 30 } }}
                  exit={{ opacity: 0, scale: 0, rotate: 90, transition: { duration: 0.1, ease: "easeIn" as const } }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-600">
                    <path d="m22 2-7 20-4-9-9-4z" />
                    <path d="M22 2 11 13" />
                  </svg>
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
