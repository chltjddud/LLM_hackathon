-- SQL Editor에서 실행: PDF로 수정안을 통째로 제안하고 양쪽 합의로 일괄 반영하는 기능용 테이블

create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  proposed_by text not null, -- tenant | landlord
  filename text,
  changes jsonb not null, -- [{ "clause_id": "...", "old_text": "...", "new_text": "..." }]
  status text not null default 'pending', -- pending | accepted | rejected
  accepted_by_tenant boolean not null default false,
  accepted_by_landlord boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_proposals_session on proposals(session_id);

-- 채팅 메시지가 특정 제안(proposal)을 가리킬 수 있게 함 (제안 카드를 채팅 안에 표시하기 위함)
alter table messages add column if not exists proposal_id uuid references proposals(id) on delete set null;
