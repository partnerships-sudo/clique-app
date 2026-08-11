-- Add scheduling fields to screening rooms so they work like watch parties
alter table screening_rooms
  add column if not exists air_date  text default null,
  add column if not exists air_time  text default null,
  add column if not exists tagline   text default null;
