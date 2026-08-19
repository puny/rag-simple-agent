"use client";

import { useEffect, useState } from "react";
import CustomAuthPage from "./CustomAuthenticator";
import "@aws-amplify/ui-react/styles.css";
import { getCurrentUser } from "aws-amplify/auth";
import { useRouter } from "next/navigation";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";

Amplify.configure(outputs);

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    getCurrentUser()
      .then(() => router.replace("/dashboard"))
      .catch(() => setIsLoading(false));
  }, [router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-600">로그인 상태를 확인하는 중입니다...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-gray-100 bg-white p-8 shadow-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            RAG Simple App
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            서비스 이용을 위해 로그인해 주세요
          </p>
        </div>

        <CustomAuthPage />
      </div>
    </main>
  );
}
