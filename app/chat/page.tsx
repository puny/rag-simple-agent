'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAIHooks } from '@aws-amplify/ui-react-ai';
import { generateClient } from 'aws-amplify/data';
import ReactMarkdown from 'react-markdown';
import type { Schema } from '../../amplify/data/resource';
import CustomAuthPage from '../CustomAuthenticator';

const client = generateClient<Schema>();
const { useAIConversation } = createAIHooks(client);
const GUEST_QUESTION_LIMIT = 10;

type ChatMessage = {
  role?: string;
  content?: Array<{ text?: string }>;
  isLoading?: boolean;
};

type ConversationSummary = {
  id: string;
  title: string;
  updatedAt?: string;
};

export default function ChatPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string>();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const handleConversationChange = useCallback((conversation: ConversationSummary) => {
    setConversations((currentConversations) => [
      ...currentConversations.filter((currentConversation) => currentConversation.id !== conversation.id),
      conversation,
    ].sort((first, second) => {
      const firstTime = first.updatedAt ? new Date(first.updatedAt).getTime() : 0;
      const secondTime = second.updatedAt ? new Date(second.updatedAt).getTime() : 0;
      return secondTime - firstTime;
    }));
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadConversations = async () => {
      // 저장된 대화 목록을 가져온 뒤 각 대화의 메시지를 확인합니다.
      const { data: conversationData } = await client.conversations.chat.list();
      const summaries = await Promise.all(
        (conversationData ?? []).map(async (conversation) => {
          const { data: conversationWithMessages } = await client.conversations.chat.get({ id: conversation.id });
          const messageResult = conversationWithMessages
            ? await conversationWithMessages.listMessages({})
            : undefined;
          const firstUserMessage = messageResult?.data?.find((message) => message.role === 'user');
          const messageTitle = firstUserMessage?.content?.map((content) => content.text).filter(Boolean).join('').trim();
          const hasAssistantResponse = messageResult?.data?.some((message) => {
            if (message.role === 'user') {
              return false;
            }

            return Boolean(message.content?.map((content) => content.text).filter(Boolean).join('').trim());
          });
          const title = conversation.name?.trim() || messageTitle;

          // 질문이 없는 빈 대화와 AI 응답이 없는 오류 대화는 목록에서 제외합니다.
          return title && hasAssistantResponse
            ? { id: conversation.id, title, updatedAt: conversation.updatedAt ?? undefined }
            : null;
        }),
      );

      if (isMounted) {
        const completedConversations = summaries
          .filter((conversation): conversation is Exclude<typeof conversation, null> => conversation !== null)
          .sort((first, second) => {
            const firstTime = first.updatedAt ? new Date(first.updatedAt).getTime() : 0;
            const secondTime = second.updatedAt ? new Date(second.updatedAt).getTime() : 0;
            return secondTime - firstTime;
          });

        setConversations((currentConversations) => [
          ...completedConversations,
          ...currentConversations.filter((currentConversation) => (
            !completedConversations.some((conversation) => conversation.id === currentConversation.id)
          )),
        ].sort((first, second) => {
          const firstTime = first.updatedAt ? new Date(first.updatedAt).getTime() : 0;
          const secondTime = second.updatedAt ? new Date(second.updatedAt).getTime() : 0;
          return secondTime - firstTime;
        }));
        setSelectedConversationId((currentConversationId) => (
          currentConversationId ?? completedConversations[0]?.id
        ));
      }
    };

    loadConversations().catch(() => {
      // 채팅 목록을 불러오지 못해도 현재 대화는 계속 사용할 수 있습니다.
    }).finally(() => {
      if (isMounted) {
        setIsLoadingConversations(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <CustomAuthPage>
      {({ user, signOut }) => {
        if (!user) {
          return null;
        }

        if (isLoadingConversations) {
          return <main className="min-h-dvh bg-slate-950" />;
        }

        const membershipTier = user.groups?.includes('PREMIUM')
          ? 'PREMIUM'
          : user.groups?.includes('GENERAL')
            ? 'GENERAL'
            : 'GUEST';

        return (
          <ChatConversation
            key={selectedConversationId ?? 'new-conversation'}
            conversationId={selectedConversationId}
            signOut={signOut}
            conversations={conversations}
            isLoadingConversations={isLoadingConversations}
            membershipTier={membershipTier}
            userId={user.username}
            onSelectConversation={setSelectedConversationId}
            onRenameConversation={(conversationId, title) => {
              setConversations((currentConversations) => currentConversations.map((conversation) => (
                conversation.id === conversationId ? { ...conversation, title } : conversation
              )));
            }}
            onConversationChange={handleConversationChange}
            onNewChat={() => setSelectedConversationId(undefined)}
          />
        );
      }}
    </CustomAuthPage>
  );
}

function ChatConversation({
  conversationId,
  signOut,
  conversations,
  isLoadingConversations,
  membershipTier,
  userId,
  onSelectConversation,
  onRenameConversation,
  onConversationChange,
  onNewChat,
}: {
  conversationId?: string;
  signOut: () => Promise<void>;
  conversations: ConversationSummary[];
  isLoadingConversations: boolean;
  membershipTier: 'GUEST' | 'GENERAL' | 'PREMIUM';
  userId: string;
  onSelectConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, title: string) => void;
  onConversationChange: (conversation: ConversationSummary) => void;
  onNewChat: () => void;
}) {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [guestQuestionCount, setGuestQuestionCount] = useState(0);
  const [editingConversationId, setEditingConversationId] = useState<string>();
  const [titleDraft, setTitleDraft] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [{ data, isLoading, hasError, errors }, sendMessage] = useAIConversation('chat', {
    id: conversationId,
  });

  useEffect(() => {
    if (membershipTier !== 'GUEST') {
      return;
    }

    setGuestQuestionCount(0);
  }, [membershipTier, userId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = input.trim();

    if (!message || isLoading || (membershipTier === 'GUEST' && guestQuestionCount >= GUEST_QUESTION_LIMIT)) {
      return;
    }

    const countResult = await client.mutations.incrementQuestionCount({});
    if (countResult.errors?.length || countResult.data === undefined) {
      return;
    }

    sendMessage({
      content: [{ text: message }],
    });
    if (membershipTier === 'GUEST') {
      setGuestQuestionCount(countResult.data ?? 0);
    }
    setInput('');
  };

  const messages = (data?.messages ?? []) as ChatMessage[];
  const errorMessage = errors?.[0]?.message;

  useEffect(() => {
    const container = messagesContainerRef.current;

    if (container && messages.length > 0) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    const firstUserMessage = messages.find((message) => message.role === 'user');
    const currentConversationId = data?.conversation?.id ?? conversationId;
    const title = firstUserMessage?.content?.map((content) => content.text).filter(Boolean).join('').trim();

    if (!currentConversationId || !title) {
      return;
    }

    onConversationChange({
      id: currentConversationId,
      title,
      updatedAt: new Date().toISOString(),
    });
  }, [conversationId, data?.conversation?.id, messages, onConversationChange]);

  const startEditingTitle = (conversation: ConversationSummary) => {
    setEditingConversationId(conversation.id);
    setTitleDraft(conversation.title);
  };

  const saveTitle = async (conversation: ConversationSummary) => {
    const title = titleDraft.trim();

    if (!title) {
      return;
    }

    const { data: updatedConversation } = await client.conversations.chat.update({
      id: conversation.id,
      name: title,
    });

    if (updatedConversation) {
      onRenameConversation(conversation.id, title);
      setEditingConversationId(undefined);
    }
  };

  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] max-w-6xl flex-col gap-4 sm:min-h-[calc(100dvh-4rem)] lg:flex-row">
        <aside className="w-full shrink-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-white shadow-2xl shadow-slate-950/30 lg:w-64">
          <div className="border-b border-slate-800 px-5 py-4">
            <h2 className="text-sm font-semibold">채팅 목록</h2>
          </div>
          <div className="max-h-44 overflow-y-auto p-2 lg:max-h-[calc(100dvh-9rem)]">
            {isLoadingConversations ? null : conversations.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-400">아직 대화가 없습니다.</p>
            ) : (
              <ul className="space-y-1">
                {conversations.map((conversation, index) => {
                  const conversationDate = conversation.updatedAt
                    ? new Date(conversation.updatedAt).toLocaleDateString('ko-KR')
                    : '날짜 없음';
                  const previousDate = index > 0 && conversations[index - 1].updatedAt
                    ? new Date(conversations[index - 1].updatedAt as string).toLocaleDateString('ko-KR')
                    : undefined;
                  const showDateSeparator = conversationDate !== previousDate;

                  return (
                    <li key={conversation.id}>
                      {showDateSeparator && (
                        <div className="px-3 pb-1 pt-3 text-xs font-semibold text-slate-500">
                          {conversationDate}
                        </div>
                      )}
                      {editingConversationId === conversation.id ? (
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            void saveTitle(conversation);
                          }}
                          className="flex gap-1 px-1 py-1"
                        >
                          <input
                            autoFocus
                            value={titleDraft}
                            onChange={(event) => setTitleDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Escape') {
                                setEditingConversationId(undefined);
                              }
                            }}
                            className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white outline-none focus:border-teal-500"
                            aria-label="대화 제목"
                          />
                          <button
                            type="submit"
                            className="rounded bg-teal-700 px-2 text-xs font-semibold text-white hover:bg-teal-600"
                          >
                            저장
                          </button>
                        </form>
                      ) : (
                        <div className="group flex items-center gap-1 rounded-lg hover:bg-slate-800">
                          <button
                            type="button"
                            onClick={() => onSelectConversation(conversation.id)}
                            className={`min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-left text-sm ${conversation.id === conversationId ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}
                            title={conversation.title}
                          >
                            {conversation.title}
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditingTitle(conversation)}
                            className="mr-2 shrink-0 rounded px-1 text-xs text-slate-500 hover:text-white"
                            title="제목 수정"
                            aria-label="제목 수정"
                          >
                            수정
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className="flex min-h-[calc(100dvh-2.5rem)] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-white shadow-2xl shadow-slate-950/30 sm:min-h-[calc(100dvh-4rem)]">
          <header className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">AI Chat</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">무엇이든 물어보세요</h1>
              <p className="mt-2 text-sm text-slate-500">AI 어시스턴트와 대화를 시작해 보세요.</p>
              <p className="mt-2 text-xs font-semibold text-slate-500">
                회원 등급: {membershipTier === 'PREMIUM' ? '프리미엄' : membershipTier === 'GENERAL' ? '일반' : '게스트'}
                {membershipTier === 'GUEST' && ` · 질문 ${guestQuestionCount}/${GUEST_QUESTION_LIMIT}`}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (window.history.length > 1) {
                    router.back();
                  } else {
                    router.push('/dashboard');
                  }
                }}
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                ← 이전으로
              </button>
              <button
                type="button"
                onClick={onNewChat}
                disabled={messages.length === 0}
                className="min-h-11 rounded-lg border border-teal-600 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
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

          <div ref={messagesContainerRef} className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-7" aria-live="polite">
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
                    {isUser ? text : (
                      <div className="markdown-content">
                        <ReactMarkdown>{text}</ReactMarkdown>
                      </div>
                    )}
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
                autoFocus
                disabled={isLoading || (membershipTier === 'GUEST' && guestQuestionCount >= GUEST_QUESTION_LIMIT)}
                className="min-h-12 w-full flex-1 rounded-lg border border-slate-300 px-4 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-100 disabled:bg-slate-100"
              />
              <button
                type="submit"
                    disabled={isLoading || !input.trim() || (membershipTier === 'GUEST' && guestQuestionCount >= GUEST_QUESTION_LIMIT)}
                className="min-h-12 w-full rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
              >
                    {isLoading ? '답변 중...' : membershipTier === 'GUEST' && guestQuestionCount >= GUEST_QUESTION_LIMIT ? '질문 한도 초과' : '보내기'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
