import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Bot, User, Activity } from 'lucide-react';
import axios from 'axios';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const AIAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '您好！我是晶圓 BI 駐守。我可以協助您查詢晶圓狀態或搜尋生產異常。您想從哪裡開始？' }
  ]);
  const [suggestions, setSuggestions] = useState<string[]>(['搜尋異常晶圓', '查詢特定 Wafer 狀態', '有哪些可用工具？']);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-ai-assistant', handleOpen);
    return () => window.removeEventListener('open-ai-assistant', handleOpen);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, suggestions]);

  const handleSend = async (overrideMessage?: string) => {
    const userMessage = overrideMessage || input.trim();
    if (!userMessage || isLoading) return;

    setInput('');
    setSuggestions([]); // Clear suggestions during loading
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await axios.post('/api/ai/chat', {
        message: userMessage,
        history: messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response.data.answer }]);
      if (response.data.suggestions) {
        setSuggestions(response.data.suggestions);
      }
    } catch (error: any) {
      console.error('AI Chat Error:', error);
      if (error.response?.status === 401 || error.response?.data?.detail === 'API_KEY_INVALID') {
        alert('⚠️ Gemini API Key 失效或未設置，請聯繫管理員。');
        setMessages(prev => [...prev, { role: 'assistant', content: '系統配置錯誤：API Key 失效。' }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，我現在無法處理您的請求。請稍後再試。' }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ai-assistant-container" style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 1000 }}>
      {/* Floating Button */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 16px rgba(99, 102, 241, 0.3)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.05) translateY(-5px)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(99, 102, 241, 0.4)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1) translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 16px rgba(99, 102, 241, 0.3)';
          }}
        >
          <Bot size={32} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="glass-card chat-window" style={{
          width: '380px',
          height: '550px',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          boxShadow: '0 12px 48px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '24px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
        }}>
          {/* Header */}
          <div style={{
            padding: '1.25rem',
            background: 'linear-gradient(90deg, #6366f1, #a855f7)',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.2)', padding: '6px', borderRadius: '12px' }}>
                <Bot size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '1rem' }}>AI 引導助手</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>Online | Wafer BI Expert</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={() => handleSend("請幫我分析當前批次的良率問題")}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 600
                }}
              >
                <Activity size={14} /> 自動檢查良率
              </button>
              <button onClick={() => setIsOpen(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', padding: '6px', borderRadius: '50%', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{
            flex: 1,
            padding: '1.25rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            background: '#f8fafc'
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                display: 'flex',
                gap: '0.75rem',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                animation: 'fadeIn 0.3s ease-out'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  background: msg.role === 'user' ? '#e2e8f0' : 'linear-gradient(135deg, #6366f1, #a855f7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: msg.role === 'assistant' ? '0 4px 8px rgba(99, 102, 241, 0.2)' : 'none'
                }}>
                  {msg.role === 'user' ? <User size={18} color="#64748b" /> : <Bot size={18} color="white" />}
                </div>
                <div style={{
                  padding: '0.85rem 1rem',
                  borderRadius: msg.role === 'user' ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                  fontSize: '0.925rem',
                  background: msg.role === 'user' ? '#6366f1' : 'white',
                  color: msg.role === 'user' ? 'white' : '#1e293b',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                  border: msg.role === 'assistant' ? '1px solid #f1f5f9' : 'none'
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            
            {/* Suggestions Chips */}
            {!isLoading && suggestions.length > 0 && (
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '0.5rem', 
                marginTop: '0.5rem',
                animation: 'slideUp 0.3s ease-out'
              }}>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s)}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '20px',
                      border: '1px solid #e2e8f0',
                      background: 'white',
                      fontSize: '0.85rem',
                      color: '#6366f1',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontWeight: 500
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = '#6366f1';
                      e.currentTarget.style.background = '#f5f3ff';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.background = 'white';
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {isLoading && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', gap: '0.75rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={18} color="white" />
                </div>
                <div style={{ padding: '0.85rem 1rem', borderRadius: '4px 18px 18px 18px', background: 'white', display: 'flex', alignItems: 'center', border: '1px solid #f1f5f9' }}>
                  <div className="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div style={{ 
            padding: '1.25rem', 
            borderTop: '1px solid #f1f5f9', 
            background: 'white', 
            display: 'flex', 
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="輸入問題，或點擊上方建議..."
                style={{
                  flex: 1,
                  padding: '0.75rem 1.25rem',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  outline: 'none',
                  fontSize: '0.925rem',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
              <button 
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: (isLoading || !input.trim()) ? 0.5 : 1,
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)',
                  transition: 'transform 0.2s'
                }}
                onMouseOver={(e) => !isLoading && (e.currentTarget.style.transform = 'scale(1.05)')}
                onMouseOut={(e) => !isLoading && (e.currentTarget.style.transform = 'scale(1)')}
              >
                <Send size={20} />
              </button>
            </div>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8', textAlign: 'center' }}>
              Powered by Gemini 1.5 Flash & MCP
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .typing-indicator { display: flex; gap: 4px; }
        .typing-indicator span { width: 6px; height: 6px; background: #94a3b8; border-radius: 50%; animation: bounce 1.4s infinite ease-in-out; }
        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
        @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
      `}</style>
    </div>
  );
};

export default AIAssistant;

