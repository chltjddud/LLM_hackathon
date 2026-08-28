-- SQL Editor에서 실행: 해커톤 기간 동안 RLS를 꺼서 anon key로 자유롭게 읽고 쓸 수 있게 합니다.
alter table sessions disable row level security;
alter table clauses disable row level security;
alter table messages disable row level security;
alter table signatures disable row level security;
