import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Message } from '../types/chat';

function CopyBtn({ text }: { text: string }) {
  const [c, setC] = useState(false);
  const copy = useCallback(() => { navigator.clipboard.writeText(text).then(() => { setC(true); setTimeout(() => setC(false), 2000); }); }, [text]);
  return <button onClick={copy} className="absolute top-2 right-2 px-2 py-0.5 text-[10px] rounded bg-gray-700/50 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">{c ? 'copied!' : 'copy'}</button>;
}

export default function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const isThinking = message.role === 'thinking';
  const isTool = message.role === 'tool_call';

  if (isTool) return (
    <div className="flex justify-center">
      <div className="px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 text-[11px] text-amber-700 dark:text-amber-400 font-mono flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        {message.toolName} {message.toolLatency && <span className="text-gray-400">{message.toolLatency}ms</span>}
      </div>
    </div>
  );

  if (isThinking) return (
    <div className="flex justify-start">
      <div className="max-w-[80%] px-4 py-2.5 rounded-2xl bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-700/20">
        <div className="flex items-center gap-2 mb-1 text-xs text-purple-600 dark:text-purple-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
          {message.thinkingLabel || 'Thinking...'}
        </div>
        <pre className="text-[11px] text-gray-500 dark:text-gray-400 whitespace-pre-wrap">{message.content}</pre>
      </div>
    </div>
  );

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0 mr-3">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707" />
          </svg>
        </div>
      )}
      <div className={`max-w-[75%] ${isUser ? 'order-first' : ''}`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${isUser ? 'bg-blue-500 text-white rounded-br-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md'}`}>
          {isUser ? <p className="whitespace-pre-wrap">{message.content}</p> : (
            <ReactMarkdown components={{
              code({ className, children }) {
                const m = /language-(\w+)/.exec(className || '');
                const code = String(children).replace(/\n$/, '');
                if (!m) return <code className="px-1.5 py-0.5 rounded bg-black/20 text-blue-600 dark:text-blue-400 text-xs font-mono">{children}</code>;
                return <div className="relative group my-2"><CopyBtn text={code} /><SyntaxHighlighter style={oneDark} language={m[1]} PreTag="div" customStyle={{ margin:0, borderRadius:6, fontSize:12, padding:'12px 16px' }}>{code}</SyntaxHighlighter></div>;
              },
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
              blockquote: ({ children }) => <blockquote className="border-l-2 border-blue-300 pl-3 my-2 text-gray-500 italic">{children}</blockquote>,
            }}>{message.content}</ReactMarkdown>
          )}
        </div>
        <div className={`text-[10px] text-gray-400 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>{new Date(message.timestamp).toLocaleTimeString()}</div>
      </div>
      {isUser && <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center shrink-0 ml-3 text-xs font-medium">U</div>}
    </div>
  );
}
