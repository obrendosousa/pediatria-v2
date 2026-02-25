"use client";

import AnalystChat from "@/components/analyst/AnalystChat";

export default function AnalystPage() {
  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-slate-50 to-pink-50/30 dark:from-[#0b141a] dark:via-[#0b141a] dark:to-[#11161d] p-4 md:p-6">
      <div className="mx-auto h-full max-w-6xl">
        <AnalystChat />
      </div>
    </div>
  );
}
