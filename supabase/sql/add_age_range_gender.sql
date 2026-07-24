alter table profiles
  add column if not exists age_range text,
  add column if not exists gender text;
