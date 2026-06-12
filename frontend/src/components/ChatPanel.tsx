/**
 * ChatPanel — OpenAI ChatGPT 风格对话面板
 *
 * 消息类型:
 *   user      — 用户消息（右对齐，品牌色气泡）
 *   assistant — AI 回复（左对齐，Markdown 渲染）
 *   tool_call — 工具调用记录（内联卡片，可折叠）
 *   thinking  — Agent 思考过程（灰底斜体，可折叠）
 *
 * 支持: Markdown · Code Highlighting · Copy Button · Typing Indicator
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// ============================================================
// Types
// ============================================================

type MessageRole = 'user' | 'assistant' | 'tool_call' | 'thinking';

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  /** tool_call: 工具名称 */
  toolName?: string;
  /** tool_call: 耗时 ms */
  toolLatency?: number;
  /** thinking: 思考步骤描述 */
  thinkingLabel?: string;
  /** 是否可折叠 */
  collapsible?: boolean;
}

// ============================================================
// Mock Demo Messages
// ============================================================

const DEMO_MESSAGES: Message[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
`👋 Hello! I'm your Vision Agent Assistant.

I can **see** what's in your camera and **hear** what you say. 

**Try:**
- Click 🎤 to record a question
- Type in the input below
- Ask about objects in the scene`,
    timestamp: Date.now(),
  },
];

// ============================================================
// Sub-components
// ============================================================

/** Copy Button */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      onClick={copy}
      className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-mono rounded-sm
                 bg-surface-overlay/80 text-gray-500 hover:text-white hover:bg-surface-overlay
                 border border-surface-border opacity-0 group-hover:opacity-100 transition-opacity"
    >
      {copied ? 'copied!' : 'copy'}
    </button>
  );
}

/** Markdown Renderer */
function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const codeText = String(children).replace(/\n$/, '');
          const isInline = !match;

          if (isInline) {
            return (
              <code className="px-1.5 py-0.5 rounded-sm bg-black/30 text-primary-400 text-[12px] font-mono" {...props}>
                {children}
              </code>
            );
          }

          return (
            <div className="relative group my-3">
              <div className="flex items-center justify-between px-3 py-1.5 rounded-t-sm bg-surface-overlay border border-surface-border border-b-0">
                <span className="text-[10px] font-mono text-gray-500">{match[1]}</span>
              </div>
              <CopyButton text={codeText} />
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  borderRadius: '0 0 4px 4px',
                  fontSize: '12px',
                  padding: '12px 16px',
                  background: '#0d1117',
                }}
              >
                {codeText}
              </SyntaxHighlighter>
            </div>
          );
        },
        p({ children }) {
          return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
        },
        strong({ children }) {
          return <strong className="text-white font-semibold">{children}</strong>;
        },
        ul({ children }) {
          return <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>;
        },
        li({ children }) {
          return <li className="text-gray-300">{children}</li>;
        },
        blockquote({ children }) {
          return <blockquote className="border-l-2 border-primary/30 pl-3 my-2 text-gray-500 italic">{children}</blockquote>;
        },
        a({ href, children }) {
          return <a href={href} target="_blank" rel="noopener" className="text-primary-400 hover:underline">{children}</a>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

/** Thinking Block */
function ThinkingBlock({ message }: { message: Message }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex justify-start animate-fade-in">
      <div className="max-w-[80%] rounded-md overflow-hidden border border-primary/20 bg-primary/5">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-mono text-primary hover:bg-primary/5 transition-colors"
        >
          <svg className={`w-3 h-3 transition-transform ${collapsed ? '' : 'rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span>{message.thinkingLabel || 'Thinking'}</span>
        </button>
        {!collapsed && (
          <div className="px-4 pb-3">
            <pre className="text-[11px] font-mono text-gray-400 whitespace-pre-wrap leading-relaxed">
              {message.content}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

/** Tool Call Block */
function ToolCallBlock({ message }: { message: Message }) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="flex justify-start animate-fade-in">
      <div className="max-w-[80%] rounded-md overflow-hidden border border-warning/20 bg-warning/5">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-mono text-warning hover:bg-warning/5 transition-colors"
        >
          <svg className={`w-3 h-3 transition-transform ${collapsed ? '' : 'rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="w-2 h-2 rounded-full bg-warning" />
          <span>Tool: {message.toolName || 'unknown'}</span>
          {message.toolLatency && (
            <span className="ml-auto text-[10px] text-gray-600">{message.toolLatency}ms</span>
          )}
        </button>
        {!collapsed && (
          <div className="px-4 pb-3">
            <pre className="text-[11px] font-mono text-gray-400 whitespace-pre-wrap leading-relaxed">
              {message.content}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

/** Typing Indicator */
function TypingIndicator() {
  return (
    <div className="flex justify-start animate-fade-in">
      <div className="flex items-center gap-3 px-4 py-3 rounded-md bg-surface-overlay border border-surface-border">
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-600 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-gray-600 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-gray-600 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-[11px] font-mono text-gray-500">Agent is thinking...</span>
      </div>
    </div>
  );
}

// ============================================================
// Message Bubble
// ============================================================

function MessageBubble({ message }: { message: Message }) {
  // Tool call & thinking use special blocks
  if (message.role === 'tool_call') return <ToolCallBlock message={message} />;
  if (message.role === 'thinking') return <ThinkingBlock message={message} />;

  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      {/* AI Avatar */}
      {!isUser && (
        <div className="w-7 h-7 rounded-sm bg-primary flex items-center justify-center shrink-0 mr-3 mt-1">
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
      )}

      {/* Content */}
      <div className={`max-w-[75%] ${isUser ? 'order-first' : ''}`}>
        <div className={`
          px-4 py-3 rounded-md text-[13px] leading-relaxed
          ${isUser
            ? 'bg-primary/20 border border-primary/20 text-gray-200 rounded-br-sm'
            : 'bg-surface-overlay border border-surface-border text-gray-300 rounded-bl-sm'}
        `}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <MarkdownContent content={message.content} />
          )}
        </div>
        {/* Timestamp */}
        <div className={`text-[9px] font-mono text-gray-700 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-7 h-7 rounded-sm bg-surface-overlay border border-surface-border flex items-center justify-center shrink-0 ml-3 mt-1">
          <span className="text-[11px] font-mono text-gray-500">U</span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

interface DetObj { id: string; label: string; confidence: number }

interface ChatPanelProps {
  externalMessage?: { role: MessageRole; content: string } | null;
  detectedObjects?: Record<string, DetObj>;
}

function ChatPanel({ externalMessage, detectedObjects }: ChatPanelProps = {}) {
  const [messages, setMessages] = useState<Message[]>(DEMO_MESSAGES);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping]);

  // Handle external messages (from VoiceRecorder)
  useEffect(() => {
    if (!externalMessage) return;
    const msg: Message = {
      id: `ext-${Date.now()}`,
      role: externalMessage.role,
      content: externalMessage.content,
      timestamp: Date.now(),
      toolName: externalMessage.toolName,
      thinkingLabel: externalMessage.thinkingLabel,
    };
    setMessages(p => [...p, msg]);

    // Simulate AI response after voice input (full pipeline)
    if (externalMessage.role === 'user') {
      setIsTyping(true);
      setTimeout(() => {
        setMessages(p => [...p, {
          id: `think-${Date.now()}`,
          role: 'thinking',
          content: `1. STT: "${externalMessage.content}"\n2. Route: planner → vision_node\n3. Analyzing camera frame`,
          thinkingLabel: 'Processing voice',
          timestamp: Date.now(),
        }]);
      }, 600);

      const objs = detectedObjects ? Object.values(detectedObjects) : [];
      const objNames = objs.map(o => o.label).join(', ');
      const objListStr = objs.map(o => `- **${o.label}** — ${Math.round(o.confidence*100)}%`).join('\n');

      setTimeout(() => {
        setMessages(p => [...p, {
          id: `tool-${Date.now()}`,
          role: 'tool_call',
          content: `vision_analysis()\n→ objects: ${objNames}\n→ count: ${objs.length}`,
          toolName: 'vision_analysis',
          toolLatency: 280,
          timestamp: Date.now(),
        }]);
      }, 1400);

      setTimeout(() => {
        setIsTyping(false);
        const response = objs.length > 0
          ? `Here's what I see:\n\n${objListStr}`
          : `Camera active — no objects detected yet.`;
        setMessages(p => [...p, {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: response,
          timestamp: Date.now(),
        }]);
      }, 2500);
    }
  }, [externalMessage]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages(p => [...p, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate full agent pipeline
    setTimeout(() => {
      setMessages(p => [...p, {
        id: `think-${Date.now()}`,
        role: 'thinking',
        content: `1. Intent: "${text}"\n2. Route: planner → vision_node\n3. Analyzing camera frame\n4. Detecting objects in scene`,
        thinkingLabel: 'Processing',
        timestamp: Date.now(),
      }]);
    }, 800);

    // Build response from actual detected objects
    const objs = detectedObjects ? Object.values(detectedObjects) : [];
    const objListStr = objs.map(o => `- **${o.label}** (${Math.round(o.confidence*100)}%)`).join('\n');
    const objNames = objs.map(o => o.label).join(', ');
    const jsonStr = JSON.stringify({ objects: objs.map(o => o.label) });

    setTimeout(() => {
      setMessages(p => [...p, {
        id: `tool-${Date.now()}`,
        role: 'tool_call',
        content: `vision_analysis()\n→ objects: ${objNames}\n→ count: ${objs.length}`,
        toolName: 'vision_analysis',
        toolLatency: 312,
        timestamp: Date.now(),
      }]);
    }, 1600);

    setTimeout(() => {
      setIsTyping(false);
      const response = objs.length > 0
        ? `I can see:\n\n${objListStr}\n\n\`\`\`json\n${jsonStr}\n\`\`\`\n\nAsk me about any of these!`
        : `Camera is active but no objects detected yet. Try pointing at something!`;
      setMessages(p => [...p, {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      }]);
    }, 2500);
  }, [input]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // Clear demo
  const handleClear = () => setMessages([{
    id: 'welcome', role: 'assistant' as const,
    content: 'Chat cleared. Start a new conversation!',
    timestamp: Date.now(),
  }]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* === Header === */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-surface-border bg-surface-raised/50 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Chat</span>
          <span className="text-[9px] font-mono text-gray-600">{messages.length} messages</span>
        </div>
        <button onClick={handleClear} className="text-[10px] font-mono text-gray-600 hover:text-gray-400 transition-colors">
          clear
        </button>
      </div>

      {/* === Messages === */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isTyping && <TypingIndicator />}
      </div>

      {/* === Input === */}
      <div className="shrink-0 px-5 pb-4 pt-2">
        <div className="flex items-end gap-2 p-2.5 bg-surface-raised border border-surface-border rounded-md focus-within:border-primary/30 transition-colors">
          <button className="p-1.5 text-gray-600 hover:text-accent transition-colors" title="Voice input">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>

          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Message Vision Agent..."
            rows={1}
            className="flex-1 bg-transparent text-[13px] text-gray-200 placeholder-gray-600
                       resize-none outline-none py-0.5"
          />

          <div className="flex items-center gap-1">
            <button
              onClick={send}
              disabled={!input.trim()}
              className="p-1.5 rounded-sm bg-primary text-white hover:bg-primary
                         disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
        <p className="text-[9px] font-mono text-gray-700 text-center mt-2">
          Vision Agent may produce inaccurate information. Verify important details.
        </p>
      </div>
    </div>
  );
}

export default ChatPanel;
