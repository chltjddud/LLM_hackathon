# 자취 계약서 리스크 도우미

임대차/알바 계약서 사진을 올리면 위험 조항을 짚어주고, 그대로 계약이 진행됐을 때의 시뮬레이션과 집주인/사장님에게 보낼 메시지 초안을 만들어주는 서비스.

## 시작하기

```bash
npm install
cp .env.local.example .env.local   # ANTHROPIC_API_KEY 값 채워넣기
npm run dev
```

http://localhost:3000 에서 확인.

## 구조

- `src/app/page.tsx` — 업로드/결과 화면 (프론트)
- `src/app/api/analyze/route.ts` — 사진 분석 API 라우트 (백엔드)
- `data/risk-criteria.json` — 위험 조항 판단 기준표 (기획). 새 카테고리 추가 시 이 파일에 항목 추가.

## 역할

- 기획/디자인: 위험 조항 기준표(`data/risk-criteria.json`) 리서치·보강, 화면 와이어프레임
- 프론트엔드: 업로드 화면, 결과 화면(조항 카드/위험도 뱃지/시뮬레이션/메시지 탭)
- 백엔드/프롬프트: `api/analyze` 파이프라인, 프롬프트 튜닝
