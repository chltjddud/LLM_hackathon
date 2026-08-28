-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.
-- RLS(row level security)는 해커톤 속도를 위해 비활성 상태로 둡니다 (기본값).

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  image_url text,
  status text not null default 'negotiating', -- negotiating | ready_to_sign | completed
  created_at timestamptz not null default now()
);

create table if not exists clauses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  clause_text text not null,
  category_id text,
  risk_level text not null default '안전', -- 안전 | 주의 | 위험
  category text,
  law_basis text,
  explanation text,
  simulation text,
  message_draft text,
  resolved_by_tenant boolean not null default false,
  resolved_by_landlord boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  clause_id uuid references clauses(id) on delete set null,
  sender_role text not null, -- tenant | landlord
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists signatures (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  role text not null, -- tenant | landlord
  signature_image text not null, -- base64 PNG
  signed_at timestamptz not null default now(),
  unique (session_id, role)
);

create index if not exists idx_clauses_session on clauses(session_id);
create index if not exists idx_messages_session on messages(session_id);
create index if not exists idx_signatures_session on signatures(session_id);
