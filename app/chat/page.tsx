'use client';

import { useState } from 'react';
import { createAIHooks } from '@aws-amplify/ui-react-ai';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import CustomAuthPage from '../CustomAuthenticator';

const client = generateClient<Schema>();
const { useAIConversation } = createAIHooks(client);

type ChatMessage = {
  role?: string;
  content?: Array<{ text?: string }>;
  isLoading?: boolean;
};

export default function ChatPage() {
  const [conversationKey, setConversationKey] = useState(() => crypto.randomUUID());

  return (
    <CustomAuthPage>
      {({ user, signOut }) => {
        if (!user) {
          return null;
        }

          return (
            <ChatConversation
              key={conversationKey}
              signOut={signOut}
              onNewChat={() => setConversationKey(crypto.randomUUID())}
            />
          );
      }}
    </CustomAuthPage>
  );
}

function ChatConversation({
  signOut,
  onNewChat,
}: {
  signOut: () => Promise<void>;
  onNewChat: () => void;
}) {
  const [input, setInput] = useState('');
  const [{ data, isLoading, hasError, errors }, sendMessage] = useAIConversation('chat');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = input.trim();

    if (!message || isLoading) {
      return;
    }

    sendMessage({
      content: [{ text: message }],
    });
    setInput('');
  };

  const messages = (data?.messages ?? []) as ChatMessage[];
  const errorMessage = errors?.[0]?.message;

  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-5 sm:px-6 sm:py-8">
            <section className="mx-auto flex min-h-[calc(100dvh-2.5rem)] max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-white shadow-2xl shadow-slate-950/30 sm:min-h-[calc(100dvh-4rem)]">
              <header className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">AI Chat</p>
                  <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">무엇이든 물어보세요</h1>
                  <p className="mt-2 text-sm text-slate-500">AI 어시스턴트와 대화를 시작해 보세요.</p>
                </div>
                
                <div className="flex gap-2">
                  {/* 새 대화 시작 버튼 */}
                  <button
                    type="button"
                    onClick={onNewChat}
                    className="min-h-11 rounded-lg border border-teal-600 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100"
                  >
                    새 대화
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await signOut();
                    }}
                    className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    로그아웃
                  </button>
                </div>
              </header>

              <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-7" aria-live="polite">
                {messages.length === 0 && !isLoading && (
                  <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                    <div>
                      <p className="font-semibold text-slate-800">첫 질문을 보내 보세요</p>
                      <p className="mt-2 text-sm text-slate-500">궁금한 내용을 아래 입력창에 작성하면 답변을 받을 수 있습니다.</p>
                    </div>
                  </div>
                )}

                {messages.map((message, index) => {
                  const isUser = message.role === 'user';
                  const text = message.content?.map((content) => content.text).filter(Boolean).join('') || (message.isLoading ? '답변을 작성하는 중...' : '');

                  return (
                    <div key={`${message.role ?? 'message'}-${index}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[75%] ${isUser ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-800'}`}>
                        {text}
                      </div>
                    </div>
                  );
                })}

                {hasError && (
                  <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage ?? '메시지를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'}
                  </p>
                )}
              </div>

              <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-4 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="메시지를 입력하세요"
                    aria-label="메시지"
                    disabled={isLoading}
                    className="min-h-12 w-full flex-1 rounded-lg border border-slate-300 px-4 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-100 disabled:bg-slate-100"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="min-h-12 w-full rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
                  >
                    {isLoading ? '답변 중...' : '보내기'}
                  </button>
                </div>
              </form>
            </section>
          </main>
  );
}