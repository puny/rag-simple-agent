# RAG Simple App

RAG Simple App은 AWS Amplify와 Next.js를 기반으로 만든 간단한 AI 채팅 서비스입니다. 사용자는 로그인 후 AI와 대화를 나누고, 대화 기록을 유지하며, 멤버십 등급에 따라 질문 가능 횟수와 모델 접근 권한을 관리할 수 있습니다.

## 프로젝트 소개

이 프로젝트는 Retrieval-Augmented Generation(RAG) 기반의 대화형 AI 서비스를 빠르게 구현해볼 수 있는 예제입니다. 단순한 챗봇이 아니라, 사용자별 권한, 질문 제한, 관리자 설정, 대화 공유 기능까지 포함한 실사용형 구조를 갖추고 있습니다.

기본 흐름은 다음과 같습니다.

- 사용자가 로그인합니다.
- 대화형 채팅 화면에서 질문을 입력합니다.
- AI가 응답을 생성합니다.
- 대화는 기록으로 보관되며, 이전 대화를 다시 열어볼 수 있습니다.
- 관리자 페이지에서 사용자 등급과 제한 설정을 관리합니다.

## 주요 기능

- AWS Cognito 기반 회원 인증
- AI 채팅 화면 및 대화 세션 관리
- 대화 제목 수정, 복사, 공유 기능
- 게스트/일반/프리미엄 멤버십별 질문 제한
- 관리자 전용 사용자 및 멤버십 관리 화면
- AWS Amplify Gen2 기반 백엔드 구조

## 기술 스택

- Next.js 15
- React 19
- TypeScript
- AWS Amplify Gen2
- Amazon Cognito
- AppSync / GraphQL 기반 데이터 모델
- DynamoDB

## 프로젝트 구조

- app/: 사용자 화면과 페이지 구성
- amplify/: Amplify 백엔드 설정 및 데이터 모델
- public/: static

## 로컬 실행

```bash
npm install
npx ampx sandbox
npm run dev
```

## 실행 환경

로그인, 데이터, AI 대화 기능을 함께 연결하여 실서비스에 가까운 형태로 구성

## 라이선스

이 프로젝트는 AWS Amplify Next.js starter 템플릿을 기반으로 개발되었으며, 원본 템플릿의 라이선스 정책을 따릅니다.

- 기반 템플릿: [aws-samples/amplify-next-template](https://github.com/aws-samples/amplify-next-template)
- 라이선스: MIT No Attribution (MIT-0)

자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.