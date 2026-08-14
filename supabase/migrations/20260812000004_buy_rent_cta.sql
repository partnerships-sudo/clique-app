-- Buy / Rent CTA for watch parties (studio tier feature)

alter table premieres
  add column if not exists buy_url   text,
  add column if not exists buy_label text;   -- e.g. "Buy on Apple TV", "Rent on Amazon"

-- Track every click on the Buy / Rent button for analytics
create table if not exists premiere_buy_clicks (
  id           uuid primary key default gen_random_uuid(),
  premiere_id  uuid not null references premieres(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  clicked_at   timestamptz not null default now()
);

create index if not exists premiere_buy_clicks_premiere_id_idx
  on premiere_buy_clicks (premiere_id);
