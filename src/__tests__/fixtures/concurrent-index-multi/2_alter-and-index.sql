-- postgres-migrations disable-transaction
alter table concurrent_multi add column label text;
create index concurrently concurrent_multi_label_idx on concurrent_multi (label);
