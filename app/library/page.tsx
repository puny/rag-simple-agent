'use client';

import { useEffect, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import { remove, uploadData } from 'aws-amplify/storage';
import { useRouter } from 'next/navigation';
import type { Schema } from '../../amplify/data/resource';
import CustomAuthPage from '../CustomAuthenticator';

const client = generateClient<Schema>();
type LibraryItem = { id: string; filename: string; s3Key: string; size: number; status?: string };

export default function LibraryPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<LibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadDocuments = async () => {
    const { data } = await client.models.LibraryDocument.list();
    setDocuments((data ?? []).map(({ id, filename, s3Key, size, status }) => ({
      id, filename, s3Key, size, status: status ?? undefined,
    })));
  };

  useEffect(() => {
    loadDocuments().catch(() => setMessage('라이브러리를 불러오지 못했습니다.')).finally(() => setIsLoading(false));
  }, []);

  const uploadDocument = async (file: File) => {
    const extensions = ['.txt', '.md', '.csv', '.json', '.pdf'];
    if (!extensions.some((extension) => file.name.toLowerCase().endsWith(extension))) {
      setMessage('txt, md, csv, json, pdf 파일만 업로드할 수 있습니다.');
      return;
    }
    if (file.size > 300 * 1024) {
      setMessage('파일 크기는 300KB 이하로 업로드해 주세요.');
      return;
    }

    try {
      setMessage('파일을 업로드하고 임베딩하는 중입니다...');
      const { identityId } = await fetchAuthSession();
      if (!identityId) throw new Error('인증 정보가 없습니다.');
      const id = crypto.randomUUID();
      const s3Key = `library/${identityId}/${id}/${file.name}`;
      const contentType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain');
      await client.models.LibraryDocument.create({
        id, filename: file.name, s3Key, contentType, size: file.size, status: 'PROCESSING',
      });
      await uploadData({ path: s3Key, data: file }).result;
      await client.mutations.indexLibraryDocument({
        documentId: id, s3Key, filename: file.name, contentType, size: file.size,
      });
      await loadDocuments();
      setMessage('업로드가 완료되었습니다.');
    } catch {
      setMessage('업로드 또는 임베딩에 실패했습니다.');
    }
  };

  const deleteDocument = async (document: LibraryItem) => {
    try {
      await remove({ path: document.s3Key });
      const { data: chunks } = await client.models.LibraryChunk.list({ filter: { documentId: { eq: document.id } } });
      await Promise.all((chunks ?? []).map((chunk) => client.models.LibraryChunk.delete({ id: chunk.id })));
      await client.models.LibraryDocument.delete({ id: document.id });
      setDocuments((current) => current.filter(({ id }) => id !== document.id));
    } catch {
      setMessage('문서 삭제에 실패했습니다.');
    }
  };

  return (
    <CustomAuthPage>
      {({ user, signOut }) => user ? (
        <main className="min-h-dvh bg-slate-950 px-4 py-5 sm:px-6 sm:py-8">
          <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-slate-800 bg-white shadow-2xl shadow-slate-950/30">
            <header className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Library</p>
                <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">내 라이브러리</h1>
                <p className="mt-2 text-sm text-slate-500">문서를 관리하고 Chat에서 사용할 라이브러리를 선택하세요.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => router.push('/chat')} className="min-h-11 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">Chat으로 이동</button>
                <button type="button" onClick={() => void signOut()} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">로그아웃</button>
              </div>
            </header>
            <section className="p-5 sm:p-8">
              <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-teal-400 bg-teal-50 text-center hover:bg-teal-100">
                <span className="font-semibold text-teal-800">파일 업로드</span>
                <span className="mt-1 text-sm text-teal-700">txt, md, csv, json, pdf · 최대 300KB</span>
                <input type="file" accept=".txt,.md,.csv,.json,.pdf,text/plain,text/csv,application/json,application/pdf" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadDocument(file); event.target.value = ''; }} />
              </label>
              {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
              <div className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200">
                {isLoading ? <p className="p-5 text-sm text-slate-500">불러오는 중...</p> : documents.length === 0 ? <p className="p-5 text-sm text-slate-500">업로드한 라이브러리가 없습니다.</p> : documents.map((document) => (
                  <div key={document.id} className="flex items-center justify-between gap-4 p-5">
                    <div className="min-w-0"><p className="truncate font-medium text-slate-900">{document.filename}</p><p className="mt-1 text-xs text-slate-500">{Math.ceil(document.size / 1024)}KB · {document.status === 'PROCESSING' ? '처리 중' : document.status === 'FAILED' ? '실패' : '검색 가능'}</p></div>
                    <button type="button" onClick={() => void deleteDocument(document)} className="shrink-0 text-sm font-semibold text-red-600 hover:text-red-800">삭제</button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </main>
      ) : null}
    </CustomAuthPage>
  );
}
