import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Loader2 } from 'lucide-react';
import { api } from '../api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatModalProps {
  onClose: () => void;
}

export const AIChatModal: React.FC<AIChatModalProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm Soboite's AI assistant. Ask me anything about where to eat or what to order!" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const { reply, error } = await api.askGemini(userMessage);
      if (error) throw new Error(error);
      
      setMessages(prev => [...prev, { role: 'assistant', content: reply || "I couldn't generate a response." }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message || 'Something went wrong.'}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col h-[65vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-6 sm:py-4 bg-white/50 backdrop-blur-xl z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="hidden xs:block">
              <h2 className="font-semibold text-gray-900 text-sm sm:text-base">Soboite AI</h2>
              <p className="text-[10px] sm:text-xs text-gray-500">Ask about restaurants & dishes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-red-50 border border-red-100 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-100 transition-colors shadow-sm"
          >
            <X size={16} strokeWidth={3} />
            Return to App
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/50 space-y-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm'}`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm'}`}>
                {/* Basic markdown parsing for line breaks */}
                {msg.content.split('\n').map((line, i) => {
                   const boldParsed = line.split(/(\*\*.*?\*\*)/g).map((part, index) => {
                     if (part.startsWith('**') && part.endsWith('**')) {
                       return <strong key={index}>{part.slice(2, -2)}</strong>;
                     }
                     return part;
                   });
                   return <p key={i} className={i > 0 ? "mt-2" : ""}>{boldParsed}</p>;
                })}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 flex-row">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm">
                <Bot size={16} />
              </div>
              <div className="max-w-[80%] rounded-2xl bg-white border border-gray-100 rounded-tl-sm px-4 py-3 text-sm shadow-sm flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-indigo-500" />
                <span className="text-gray-500">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 bg-white p-4 pb-safe">
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Where should I eat?"
              className="w-full rounded-full border border-gray-200 bg-gray-50 py-3 pl-4 pr-12 text-sm text-gray-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white transition-transform hover:scale-105 active:scale-95 disabled:scale-100 disabled:opacity-50"
            >
              <Send size={16} className="ml-0.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
