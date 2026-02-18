import { ReactNode } from 'react';

interface AutomationWorkspaceHeaderProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export default function AutomationWorkspaceHeader({
  title,
  description,
  action,
}: AutomationWorkspaceHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-xl font-black text-slate-800 dark:text-gray-100">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1 max-w-2xl">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
