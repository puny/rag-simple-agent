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
          <main className="min-h-screen bg-gray-50 px-4 py-12">
            <div className="mx-auto max-w-5xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <div className="flex items-center justify-between gap-4 border-b border-gray-200 pb-6">
                <div>
                  <p className="text-sm font-medium uppercase tracking-wide text-blue-600">
                    Dashboard
                  </p>
                  <h1 className="mt-2 text-3xl font-bold text-gray-900">
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
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  로그아웃
                </button>
              </div>

              <div className="mt-8 grid gap-6 md:grid-cols-3">
                <div className="rounded-xl bg-blue-50 p-5">
                  <p className="text-sm text-blue-700">사용자</p>
                  <p className="mt-2 text-xl font-semibold text-gray-900">
                    {user.nickname ?? "Guest"}
                  </p>
                  {/* <p className="mt-2 break-all text-xs text-gray-500">
                    ID: {user.userId}
                  </p> */}
                </div>

                <div className="rounded-xl bg-green-50 p-5">
                  <p className="text-sm text-green-700">상태</p>
                  <p className="mt-2 text-xl font-semibold text-gray-900">로그인 완료</p>
                </div>

                <div className="rounded-xl bg-purple-50 p-5">
                  <p className="text-sm text-purple-700">마지막 액션</p>
                  <p className="mt-2 text-xl font-semibold text-gray-900">대시보드 접속</p>
                </div>
              </div>

              <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-6">
                <h2 className="text-lg font-semibold text-gray-900">대시보드</h2>
                <p className="mt-2 text-sm text-gray-600">
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
