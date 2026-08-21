"use client";

// import { Authenticator } from "@aws-amplify/ui-react";
import CustomAuthPage from "../CustomAuthenticator";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();

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
