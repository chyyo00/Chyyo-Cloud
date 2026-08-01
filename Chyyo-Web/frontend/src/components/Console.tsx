import { useEffect, useMemo, useRef, useState } from 'react';
import { Terminal, Search, Download, Eraser, ChevronDown, CornerDownLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ConsoleLine } from '../hooks/useServerConsole';

interface Props {
  lines: ConsoleLine[];
  loading: boolean;
  onSend: (command: string) => Promise<{ ok: boolean; error?: string }>;
  onLoadHistory: () => void;
  onClear: () => void;
}

export function Console({ lines, loading, onSend, onLoadHistory, onClear }: Props) {
  const [query, setQuery] = useState('');
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [stickToBottom, setStickToBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void onLoadHistory();
  }, [onLoadHistory]);

  useEffect(() => {
    if (stickToBottom && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, stickToBottom]);

  const filtered = useMemo(() => {
    if (!query) return lines;
    return lines.filter((l) => l.line.toLowerCase().includes(query.toLowerCase()));
  }, [lines, query]);

  const submit = async () => {
    const cmd = input.trim();
    if (!cmd) return;
    const res = await onSend(cmd);
    if (res.ok) {
      setHistory((h) => [cmd, ...h].slice(0, 100));
      setHistoryIdx(-1);
      setInput('');
    }
  };

  const download = () => {
    const text = lines.map((l) => l.line).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `console-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-black/80 shadow-2xl backdrop-blur-xl">
      {/* 헤더 */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.03] px-4 py-3">
        <span className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
          <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
          <span className="h-3 w-3 rounded-full bg-[#28C840]" />
        </span>
        <Terminal className="ml-3 h-4 w-4 text-zinc-500" />
        <span className="text-xs font-medium text-zinc-400">콘솔</span>

        <div className="ml-auto flex items-center gap-1">
          <div className="relative mr-1 hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="로그 검색..."
              className="w-44 rounded-xl border border-white/10 bg-white/[0.05] py-1.5 pl-8 pr-3 text-xs text-white outline-none placeholder-zinc-500 focus:border-accent/60"
            />
          </div>
          <button onClick={onClear} title="지우기" className="rounded-xl p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-white">
            <Eraser className="h-4 w-4" />
          </button>
          <button onClick={download} title="로그 다운로드" className="rounded-xl p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-white">
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 로그 영역 */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
          setStickToBottom(nearBottom);
        }}
        className="relative h-[420px] overflow-y-auto bg-black/60 px-4 py-3 font-mono text-[12.5px] leading-relaxed"
      >
        {loading && (
          <div className="text-zinc-600">로그를 불러오는 중...</div>
        )}
        {filtered.length === 0 && !loading && (
          <div className="text-zinc-600">아직 로그가 없습니다. 서버를 시작하면 실시간으로 표시됩니다.</div>
        )}
        {filtered.map((l, i) => (
          <div key={i} className={cn('console-text whitespace-pre-wrap break-all', colorize(l.line))}>
            {l.line}
          </div>
        ))}
        {!stickToBottom && filtered.length > 0 && (
          <button
            onClick={() => {
              setStickToBottom(true);
              if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-[#1a1a20]/90 px-3 py-1 text-[11px] text-zinc-300 shadow-xl"
          >
            <ChevronDown className="mr-1 inline h-3 w-3" /> 최신으로
          </button>
        )}
      </div>

      {/* 입력 */}
      <div className="flex items-center gap-2 border-t border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <span className="font-mono text-accent-soft">›</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
            else if (e.key === 'ArrowUp') {
              e.preventDefault();
              const next = Math.min(historyIdx + 1, history.length - 1);
              setHistoryIdx(next);
              if (history[next]) setInput(history[next]);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              const next = Math.max(historyIdx - 1, -1);
              setHistoryIdx(next);
              setInput(next === -1 ? '' : history[next] ?? '');
            }
          }}
          placeholder="Minecraft 명령어 입력 (예: list, say hello, weather clear)..."
          className="flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder-zinc-600"
        />
        <button
          onClick={() => void submit()}
          className="rounded-xl bg-accent/20 p-2 text-accent-soft transition hover:bg-accent/30"
        >
          <CornerDownLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function colorize(line: string): string {
  const l = line.toLowerCase();
  if (l.includes('exception') || l.includes('error') || l.includes('failed')) return 'text-red-400';
  if (l.includes('warn')) return 'text-amber-300';
  if (l.includes('[info]') || l.includes('done') || l.includes('starting')) return 'text-emerald-300/90';
  if (l.includes('joined the game')) return 'text-accent-soft';
  return 'text-zinc-300';
}
