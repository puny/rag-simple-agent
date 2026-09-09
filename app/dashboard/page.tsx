"use client";

import { useEffect, useState } from "react";
import { generateClient } from "aws-amplify/data";
import { fetchAuthSession } from "aws-amplify/auth";
import { remove, uploadData } from "aws-amplify/storage";
import type { Schema } from "../../amplify/data/resource";
import CustomAuthPage from "../CustomAuthenticator";
import { useRouter } from "next/navigation";

const client = generateClient<Schema>();

export default function DashboardPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Array<{ id: string; filename: string; s3Key: string; size: number; status?: string }>>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [uploadError, setUploadError] = useState('');

  const loadDocuments = async () => {
    const { data } = await client.models.LibraryDocument.list();
    setDocuments((data ?? []).map((document) => ({
      id: document.id,
      filename: document.filename,
      s3Key: document.s3Key,
      size: document.size,
      status: document.status ?? undefined,
    })));
  };

  useEffect(() => {
    loadDocuments().catch(() => setUploadError('라이브러리를 불러오지 못했습니다.')).finally(() => setIsLoadingDocuments(false));
  }, []);

  const uploadDocument = async (file: File) => {
    setUploadError('');
    const supportedExtensions = ['.txt', '.md', '.csv', '.json'];
    if (!supportedExtensions.some((extension) => file.name.toLowerCase().endsWith(extension))) {
      setUploadError('txt, md, csv, json 파일만 업로드할 수 있습니다.');
      return;
    }

    if (file.size > 300 * 1024) {
      setUploadError('현재는 텍스트 파일을 300KB 이하로 업로드해 주세요.');
      return;
    }

    try {
      const { identityId } = await fetchAuthSession();
      if (!identityId) {
        throw new Error('인증 정보를 확인할 수 없습니다.');
      }
      const documentId = crypto.randomUUID();
      const s3Key = `library/${identityId}/${documentId}/${file.name}`;
      await client.models.LibraryDocument.create({
        id: documentId,
        filename: file.name,
        s3Key,
        contentType: file.type || 'text/plain',
        size: file.size,
        status: 'PROCESSING',
      });
      await uploadData({ path: s3Key, data: file }).result;
      await client.mutations.indexLibraryDocument({
        documentId,
        s3Key,
        filename: file.name,
        contentType: file.type || 'text/plain',
        size: file.size,
      });
      await loadDocuments();
    } catch {
      setUploadError('파일 업로드에 실패했습니다.');
    }
  };

  const deleteDocument = async (id: string) => {
    const document = documents.find((currentDocument) => currentDocument.id === id);
    if (!document) return;
    await remove({ path: document.s3Key });
    const { data: chunks } = await client.models.LibraryChunk.list({ filter: { documentId: { eq: id } } });
    await Promise.all((chunks ?? []).map((chunk) => client.models.LibraryChunk.delete({ id: chunk.id })));
    await client.models.LibraryDocument.delete({ id });
    setDocuments((currentDocuments) => currentDocuments.filter((document) => document.id !== id));
  };

  return (
    <CustomAuthPage>
      {({ user, signOut }) => {
        if (!user) {
          return null;
        }

        return (
          <main className="min-h-dvh bg-slate-950 px-4 py-5 sm:px-6 sm:py-8">
              <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-slate-800 bg-white shadow-2xl shadow-slate-950/30">
                <div className="flex flex-col gap-5 border-b border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
                    Dashboard
                  </p>
                    <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">
                    환영합니다
                  </h1>
                </div>

                <button
                  type="button"
                  onClick={() => router.push("/chat")}
                  className="min-h-11 w-full rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-4 focus:ring-teal-200 sm:w-auto"
                >
                  Chat 시작
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/library")}
                  className="min-h-11 w-full rounded-lg border border-teal-600 bg-white px-4 py-2 text-sm font-semibold text-teal-700 transition hover:bg-teal-50 focus:outline-none focus:ring-4 focus:ring-teal-100 sm:w-auto"
                >
                  라이브러리 관리
                </button>

                {user.groups?.includes("ADMINS") && (
                  <button
                    type="button"
                    onClick={() => router.push("/admin")}
                    className="min-h-11 w-full rounded-lg border border-teal-600 bg-white px-4 py-2 text-sm font-semibold text-teal-700 transition hover:bg-teal-50 focus:outline-none focus:ring-4 focus:ring-teal-100 sm:w-auto"
                  >
                    관리자 페이지
                  </button>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    if (signOut) {
                      await signOut();
                    }
                    router.push("/login");
                  }}
                  className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-teal-100 sm:w-auto"
                >
                  로그아웃
                </button>
              </div>

              <div className="grid gap-4 p-5 sm:grid-cols-3 sm:gap-5 sm:p-8">
                <div className="rounded-xl border border-teal-100 bg-teal-50 p-5">
                  <p className="text-sm font-medium text-teal-700">사용자</p>
                  <p className="mt-2 break-words text-xl font-semibold text-slate-900">
                    {user.nickname ?? "Guest"}
                  </p>
                  {/* <p className="mt-2 break-all text-xs text-gray-500">
                    ID: {user.userId}
                  </p> */}
                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5">
                  <p className="text-sm font-medium text-emerald-700">상태</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">로그인 완료</p>
                </div>

                <div className="rounded-xl border border-amber-100 bg-amber-50 p-5">
                  <p className="text-sm font-medium text-amber-700">마지막 액션</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">대시보드 접속</p>
                </div>
              </div>

              <section className="mx-5 mb-5 border-t border-slate-200 pt-5 sm:mx-8 sm:mb-8 sm:pt-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">내 라이브러리</h2>
                    <p className="mt-1 text-sm text-slate-600">업로드한 문서를 기반으로 Chat에서 답변을 받을 수 있습니다.</p>
                  </div>
                  <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                    파일 업로드
                    <input
                      type="file"
                      accept=".txt,.md,.csv,.json,text/plain,text/csv,application/json"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadDocument(file);
                        event.target.value = '';
                      }}
                    />
                  </label>
                </div>
                {uploadError && <p className="mt-3 text-sm text-red-600">{uploadError}</p>}
                <div className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200">
                  {isLoadingDocuments ? (
                    <p className="p-4 text-sm text-slate-500">라이브러리를 불러오는 중...</p>
                  ) : documents.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">아직 업로드한 문서가 없습니다.</p>
                  ) : documents.map((document) => (
                    <div key={document.id} className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{document.filename}</p>
                        <p className="mt-1 text-xs text-slate-500">{Math.ceil(document.size / 1024)}KB · {document.status === 'PROCESSING' ? '처리 중' : document.status === 'FAILED' ? '실패' : '검색 가능'}</p>
                      </div>
                      <button type="button" onClick={() => void deleteDocument(document.id)} className="shrink-0 text-sm font-semibold text-red-600 hover:text-red-800">
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <div className="mx-5 mb-5 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:mx-8 sm:mb-8 sm:p-6">
                <h2 className="text-lg font-semibold text-slate-900">대시보드</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  로그인에 성공해서 이 페이지에 접근했습니다. 이후 기능을 추가해 자유롭게 확장할 수 있습니다.
                </p>
              </div>
            </div>
          </main>
        );
      }}
    </CustomAuthPage>
  );
}
