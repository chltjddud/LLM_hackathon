-- SQL Editor에서 실행: S3 저장 URL을 담을 컬럼 추가

alter table sessions add column if not exists image_s3_url text;
alter table sessions add column if not exists signed_document_url text;
alter table signatures add column if not exists signature_s3_url text;
