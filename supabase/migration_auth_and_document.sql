-- SQL Editor에서 실행: 로그인(계정 연결) + 최종 계약서 문서 기능을 위한 컬럼 추가

alter table sessions add column if not exists tenant_user_id uuid references auth.users(id);
alter table sessions add column if not exists landlord_user_id uuid references auth.users(id);

-- 원문 보존: 협상으로 조항이 수정돼도 최초 분석 결과(원본)를 남겨서 "무엇이 바뀌었는지" 비교 가능하게 함
alter table clauses add column if not exists original_text text;
update clauses set original_text = clause_text where original_text is null;

create index if not exists idx_sessions_tenant_user on sessions(tenant_user_id);
create index if not exists idx_sessions_landlord_user on sessions(landlord_user_id);
