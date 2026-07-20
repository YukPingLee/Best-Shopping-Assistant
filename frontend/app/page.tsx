"use client";

import { useEffect, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type Product = {
  name: string;
  brand: string;
  price: number;
  url: string;
  category: string;
  rating: number | null;
  review_summary: string | null;
  specifications: string[];
};

type ProductFeedback = {
  name: string;
  pros: string[];
  cons: string[];
  feedback: string;
};

type ComparisonResult = {
  summary: string;
  product_feedback: ProductFeedback[];
  recommended_product: string | null;
  recommendation_reason: string;
};

type RecommendResponse = {
  status: "ready" | "needs_clarification" | "invalid";
  message: string;
  conversation: ChatMessage[];
  products: Product[];
  comparison: ComparisonResult | null;
};

type Conversation = {
  id: number;
  title: string;
  messages: ChatMessage[];
  status: string | null;
  products: Product[];
  comparison: ComparisonResult | null;
};

const sampleQuestions = [
  "Waterproof hiking shoes under $200",
  "A laptop for video editing under $1200",
  "Noise cancelling headphones for flights",
  "A budget smartphone that runs Google Maps and Uber",
];

const storageKey = "best-shopping-assistant-conversations";

function newConversation(id: number): Conversation {
  return {
    id,
    title: "New Search",
    messages: [],
    status: null,
    products: [],
    comparison: null,
  };
}

export default function Home() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL!;

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [currentChatId, setCurrentChatId] = useState<number>(1);
  const [conversations, setConversations] = useState<Conversation[]>([
    newConversation(1),
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, currentChatId, loading]);

  useEffect(() => {
    if (!mounted) return;

    const saved = localStorage.getItem(storageKey);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      if (parsed.conversations && parsed.conversations.length > 0) {
        setConversations(parsed.conversations);
        setCurrentChatId(parsed.currentChatId);
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;

    localStorage.setItem(storageKey, JSON.stringify({ conversations, currentChatId }));
  }, [mounted, conversations, currentChatId]);

  function createNewChat() {
    const newId = Date.now();
    setConversations((prev) => [...prev, newConversation(newId)]);
    setCurrentChatId(newId);
  }

  function deleteConversation(id: number) {
    const updated = conversations.filter((chat) => chat.id !== id);

    if (updated.length === 0) {
      const fresh = newConversation(1);
      setConversations([fresh]);
      setCurrentChatId(1);
      return;
    }

    setConversations(updated);

    if (currentChatId === id) {
      setCurrentChatId(updated[0].id);
    }
  }

  async function handleSend(forcedQuestion?: string) {
    const text = (forcedQuestion || question).trim();
    if (!text) return;

    const targetChatId = currentChatId;

    let priorMessages: ChatMessage[] = [];
    for (const chat of conversations) {
      if (chat.id === targetChatId) {
        priorMessages = chat.messages;
        break;
      }
    }

    setQuestion("");
    setLoading(true);

    setConversations((prev) =>
      prev.map((chat) => {
        if (chat.id !== targetChatId) return chat;
        return {
          ...chat,
          title: chat.messages.length === 0 ? text : chat.title,
          messages: [...chat.messages, { role: "user", content: text }],
        };
      })
    );

    try {
      const response = await fetch(`${API_URL}/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversation: priorMessages }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: RecommendResponse = await response.json();

      setConversations((prev) =>
        prev.map((chat) => {
          if (chat.id !== targetChatId) return chat;
          return {
            ...chat,
            messages: data.conversation,
            status: data.status,
            products: data.products,
            comparison: data.comparison,
          };
        })
      );
    } catch (err) {
      console.error(err);
      setConversations((prev) =>
        prev.map((chat) => {
          if (chat.id !== targetChatId) return chat;
          return {
            ...chat,
            messages: [
              ...chat.messages,
              {
                role: "assistant",
                content: "Something went wrong reaching the assistant. Please try again.",
              },
            ],
          };
        })
      );
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) {
    return null;
  }

  let activeChat: Conversation = conversations[0];
  for (const chat of conversations) {
    if (chat.id === currentChatId) {
      activeChat = chat;
      break;
    }
  }

  return (
    <main className="flex h-screen bg-slate-50 font-sans antialiased text-slate-800">
      {/* Sidebar */}
      <div className="w-72 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 shadow-xl">
        <div className="p-4 flex flex-col h-full overflow-hidden">
          <div className="flex items-center gap-2.5 px-2 py-3 mb-4 border-b border-slate-800">
            <span className="text-2xl">🛍️</span>
            <div>
              <h1 className="font-bold text-base tracking-wide text-white leading-tight">
                Shop Buddy
              </h1>
              <p className="text-[11px] text-slate-400 leading-tight">Your shopping sidekick</p>
            </div>
          </div>

          <button
            onClick={createNewChat}
            className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 transition text-white font-medium p-2.5 rounded-lg mb-3 flex items-center justify-center gap-2 shadow-sm"
          >
            + New Search
          </button>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 mt-2">
            <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase px-2 mb-2">
              History
            </p>
            {conversations.map((chat) => (
              <div
                key={chat.id}
                className={`group flex items-center rounded-lg transition-all duration-150 ${
                  currentChatId === chat.id
                    ? "bg-slate-800 text-white shadow-inner border border-slate-700/50"
                    : "hover:bg-slate-800/40 text-slate-400 hover:text-slate-200"
                }`}
              >
                <button
                  onClick={() => setCurrentChatId(chat.id)}
                  className="flex-1 text-left p-2.5 text-sm truncate font-medium"
                >
                  {chat.title}
                </button>
                <button
                  onClick={() => deleteConversation(chat.id)}
                  className="p-2.5 text-slate-600 hover:text-red-400 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main workspace */}
      <div className="flex flex-col flex-1 h-full overflow-hidden bg-slate-50">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeChat.messages.length === 0 && (
            <div className="max-w-2xl mx-auto my-12 text-center space-y-6">
              <div className="h-14 w-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto shadow-inner border border-emerald-100 text-3xl">
                🛍️
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Hey! What are you shopping for?</h2>
                <p className="text-slate-500 text-sm mt-1">
                  Tell me what you need, your budget, and what it's for — I'll dig around and give
                  you my honest take.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-left">
                {sampleQuestions.map((sample) => (
                  <button
                    key={sample}
                    onClick={() => handleSend(sample)}
                    className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 font-medium transition hover:border-emerald-300 text-left hover:shadow-sm"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeChat.messages.map((message, index) => (
            <div
              key={index}
              className={`flex items-end gap-2.5 max-w-2xl mx-auto ${
                message.role === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              <div
                className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-sm ${
                  message.role === "user"
                    ? "bg-slate-800 text-slate-200"
                    : "bg-emerald-100 border border-emerald-200"
                }`}
              >
                {message.role === "user" ? "🙂" : "🛍️"}
              </div>
              <div
                className={`rounded-2xl p-4 shadow-sm border text-sm leading-relaxed max-w-[80%] ${
                  message.role === "user"
                    ? "bg-slate-800 text-slate-100 border-slate-700"
                    : "bg-white text-slate-800 border-slate-200"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="max-w-2xl mx-auto flex items-end gap-2.5">
              <div className="h-8 w-8 shrink-0 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-sm">
                🛍️
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 text-slate-400 text-sm flex items-center gap-3">
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce" />
                </div>
                <span>Let me dig around for you...</span>
              </div>
            </div>
          )}

          {activeChat.status === "ready" && activeChat.products.length > 0 && (
            <div className="max-w-2xl mx-auto space-y-4">
              {activeChat.comparison?.summary && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <p className="font-semibold text-slate-700 text-xs uppercase mb-1.5">
                    Here's what I found
                  </p>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {activeChat.comparison.summary}
                  </p>
                </div>
              )}

              {activeChat.products.map((product, index) => {
                let feedback: ProductFeedback | undefined;
                for (const candidate of activeChat.comparison?.product_feedback ?? []) {
                  if (candidate.name === product.name) {
                    feedback = candidate;
                    break;
                  }
                }

                const isRecommended = activeChat.comparison?.recommended_product === product.name;

                return (
                  <div
                    key={index}
                    className={`rounded-2xl p-4 border shadow-sm bg-white ${
                      isRecommended
                        ? "border-emerald-400 ring-1 ring-emerald-300"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-800">{product.name}</h3>
                      {isRecommended && (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          🏆 My pick
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-slate-500 mt-0.5">
                      {product.brand} · ${product.price.toFixed(2)}
                      {product.rating !== null && ` · ${product.rating}★`}
                    </p>

                    {product.review_summary && (
                      <p className="text-sm text-slate-600 mt-2 italic">
                        "{product.review_summary}"
                      </p>
                    )}

                    {feedback && (
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="font-semibold text-emerald-700 text-xs uppercase mb-1">
                            Pros
                          </p>
                          <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                            {feedback.pros.map((pro, i) => (
                              <li key={i}>{pro}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-semibold text-red-600 text-xs uppercase mb-1">
                            Cons
                          </p>
                          <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                            {feedback.cons.map((con, i) => (
                              <li key={i}>{con}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {isRecommended && activeChat.comparison?.recommendation_reason && (
                      <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 mt-3">
                        <span className="font-semibold">Why I'd go with this: </span>
                        {activeChat.comparison.recommendation_reason}
                      </p>
                    )}

                    <a
                      href={product.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-xs text-slate-500 hover:text-slate-700 underline mt-3"
                    >
                      View product
                    </a>
                  </div>
                );
              })}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-white border-t border-slate-200 shadow-lg shadow-slate-100/50">
          <div className="max-w-2xl mx-auto flex gap-2.5">
            <input
              disabled={loading}
              className="flex-1 border border-slate-300 rounded-xl p-3.5 text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-inner disabled:bg-slate-100 disabled:text-slate-400"
              placeholder="e.g. waterproof hiking shoes under $200"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSend();
                }
              }}
            />
            <button
              disabled={loading}
              onClick={() => handleSend()}
              className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 transition-all text-white px-6 py-3.5 text-sm font-semibold rounded-xl disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {loading ? "Thinking..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
