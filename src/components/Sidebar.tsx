import { useState } from 'react';
import { MoreHorizontal, Pencil, Pin, PinOff, Search, Sparkles, Trash2, X } from 'lucide-react';
import type { Conversation } from '../lib/types';
import { relativeTime } from '../lib/ui-utils';
import type { ThreadGroup } from '../lib/types';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  groups: ThreadGroup[];
  activeId: string | null;
  query: string;
  onQueryChange: (q: string) => void;
  searching: boolean;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
}

export function Sidebar({
  open,
  onClose,
  groups,
  activeId,
  query,
  onQueryChange,
  searching,
  onNewChat,
  onSelect,
  onRename,
  onDelete,
  onTogglePin,
}: SidebarProps) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const startRename = (c: Conversation) => {
    setEditingId(c.id);
    setDraftTitle(c.title);
    setMenuFor(null);
  };

  const commitRename = () => {
    if (editingId && draftTitle.trim()) onRename(editingId, draftTitle.trim());
    setEditingId(null);
  };

  return (
    <>
      {open && (
        <button
          aria-label="Close sidebar"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-zinc-200/70 bg-white/95 backdrop-blur transition-transform duration-300 dark:border-white/5 dark:bg-[#191920]/95 md:static md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 px-4 pt-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <Sparkles size={16} />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Vibe Chat</span>
          <button
            onClick={onClose}
            className="ml-auto rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 md:hidden"
            aria-label="Close sidebar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-3 pt-4">
          <button
            onClick={onNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
          >
            <Sparkles size={15} /> New chat
          </button>
        </div>

        <div className="px-3 pt-3">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search chats…"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-8 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-white/10 dark:bg-white/5 dark:focus:border-white/25"
            />
          </div>
        </div>

        <nav className="scrollbar-thin mt-3 flex-1 overflow-y-auto px-2 pb-4" aria-label="Chat history">
          {searching && groups.length === 0 && (
            <div className="space-y-2 px-2 pt-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton h-12 w-full" style={{ opacity: 1 - i * 0.15 }} />
              ))}
            </div>
          )}
          {!searching && groups.length === 0 && (
            <p className="px-3 pt-6 text-center text-sm text-zinc-500">
              {query ? 'No chats match your search.' : 'No chats yet. Start one!'}
            </p>
          )}
          {groups.map((group) => (
            <div key={group.label} className="mb-3">
              <h3 className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {group.label}
              </h3>
              <ul className="space-y-0.5">
                {group.conversations.map((c) => {
                  const active = c.id === activeId;
                  return (
                    <li key={c.id} className="relative">
                      {editingId === c.id ? (
                        <input
                          autoFocus
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename();
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className={`w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-white/20 dark:bg-white/5`}
                        />
                      ) : (
                        <div
                          className={`group/item flex items-center rounded-lg transition ${
                            active
                              ? 'bg-zinc-200/80 ring-1 ring-inset ring-zinc-300 dark:bg-white/10 dark:ring-white/15'
                              : 'hover:bg-zinc-200/60 dark:hover:bg-white/5'
                          }`}
                        >
                          <button
                            onClick={() => onSelect(c.id)}
                            className="min-w-0 flex-1 px-3 py-2 text-left"
                          >
                            <span
                              className={`block truncate text-sm ${
                                active ? 'font-medium text-zinc-900 dark:text-zinc-100' : ''
                              }`}
                            >
                              {c.title}
                            </span>
                            <span className="block text-[11px] text-zinc-400 dark:text-zinc-500">
                              {relativeTime(c.updated_at)}
                            </span>
                          </button>
                          <button
                            onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}
                            className={`mr-1 rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-300/60 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-200 ${
                              menuFor === c.id ? 'opacity-100' : 'opacity-0 group-hover/item:opacity-100'
                            }`}
                            aria-label={`Options for ${c.title}`}
                            aria-expanded={menuFor === c.id}
                          >
                            <MoreHorizontal size={15} />
                          </button>
                        </div>
                      )}

                      {menuFor === c.id && (
                        <div className="absolute right-2 z-20 mt-1 w-40 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-white/10 dark:bg-[#232330]">
                          {confirmDeleteId === c.id ? (
                            <div className="p-2">
                              <p className="px-1 pb-2 text-xs text-zinc-500">Delete this chat for good?</p>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => {
                                    onDelete(c.id);
                                    setMenuFor(null);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="flex-1 rounded-lg bg-red-500 px-2 py-1.5 text-xs font-medium text-white hover:bg-red-400"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="flex-1 rounded-lg bg-zinc-200 px-2 py-1.5 text-xs font-medium dark:bg-white/10"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  onTogglePin(c.id, !c.pinned);
                                  setMenuFor(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-white/5"
                              >
                                {c.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                                {c.pinned ? 'Unpin' : 'Pin to top'}
                              </button>
                              <button
                                onClick={() => startRename(c)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-white/5"
                              >
                                <Pencil size={14} /> Rename
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(c.id)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10"
                              >
                                <Trash2 size={14} /> Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
