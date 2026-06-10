-- ============================================================
-- Leave Now — initial schema
-- Run this in the Supabase SQL editor (project → SQL Editor)
-- ============================================================

-- --------------------------------------------------------
-- Static GTFS tables
-- Populated by scripts/load-gtfs.ts, refreshed weekly.
-- Only the stops you care about are loaded — NOT the full feed.
-- --------------------------------------------------------

create table stops (
  stop_id   text primary key,
  stop_name text not null,
  stop_lat  numeric(9,6),
  stop_lon  numeric(9,6)
);

create table routes (
  route_id          text primary key,
  route_short_name  text not null,   -- e.g. "39A"
  route_long_name   text,
  route_type        integer          -- 3 = bus
);

create table trips (
  trip_id       text primary key,
  route_id      text not null references routes(route_id),
  service_id    text not null,       -- joins calendar / calendar_dates
  trip_headsign text,
  direction_id  integer              -- 0 = outbound, 1 = inbound
);
create index trips_service_id_idx on trips(service_id);
create index trips_route_id_idx   on trips(route_id);

-- departure_time stored as TEXT because GTFS allows post-midnight values
-- like "25:30:00" for services that run after midnight (not valid SQL time).
-- Normalise to seconds-since-midnight in application code only.
create table stop_times (
  id             bigserial primary key,
  trip_id        text not null references trips(trip_id),
  stop_id        text not null references stops(stop_id),
  departure_time text not null,
  stop_sequence  integer not null
);
create index stop_times_stop_id_idx   on stop_times(stop_id);
create index stop_times_trip_id_idx   on stop_times(trip_id);
create index stop_times_stop_trip_idx on stop_times(stop_id, trip_id);

create table calendar (
  service_id  text primary key,
  monday      boolean not null,
  tuesday     boolean not null,
  wednesday   boolean not null,
  thursday    boolean not null,
  friday      boolean not null,
  saturday    boolean not null,
  sunday      boolean not null,
  start_date  date not null,
  end_date    date not null
);

create table calendar_dates (
  service_id     text not null,
  date           date not null,
  exception_type integer not null,  -- 1 = added service, 2 = removed service
  primary key (service_id, date)
);
create index calendar_dates_date_idx on calendar_dates(date);

-- --------------------------------------------------------
-- Live delay cache
-- Written every minute by the GTFS-R cron job (Stage 2).
-- One row per (trip_id, stop_id) pair from the live feed.
-- Rows older than 5 minutes are purged by the cron job.
-- --------------------------------------------------------

create table trip_delays (
  trip_id       text not null,
  stop_id       text not null,
  delay_seconds integer not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (trip_id, stop_id)
);
create index trip_delays_stop_id_idx  on trip_delays(stop_id);
create index trip_delays_updated_idx  on trip_delays(updated_at);

-- --------------------------------------------------------
-- User configuration
-- Single-user app — no auth required for Stage 1-3.
-- --------------------------------------------------------

-- Single-row settings table. Seeded with defaults on first use.
create table user_settings (
  id                   integer primary key default 1,
  -- Walking pace in minutes per kilometre.
  -- 14 = leisurely, 12 = average, 10 = brisk, 8 = fast
  walk_pace_min_per_km numeric(4,1) not null default 12.0,
  -- Optional home/origin coordinates.
  -- When set, walk_minutes is auto-calculated from distance × pace.
  origin_lat           numeric(9,6),
  origin_lon           numeric(9,6)
);
insert into user_settings (id) values (1);

create table user_stops (
  id                    serial primary key,
  stop_id               text not null references stops(stop_id),
  -- walk_minutes: auto-calculated from pace × distance when origin is set.
  -- Null until either origin is set or user enters it manually.
  walk_minutes          numeric(4,1),
  -- walk_minutes_override: set by the user via the inline edit in settings.
  -- Takes precedence over the calculated value.
  walk_minutes_override numeric(4,1),
  label                 text,        -- e.g. "Home", "Work"
  unique(stop_id)
);

-- --------------------------------------------------------
-- Push notification subscriptions (Stage 3)
-- --------------------------------------------------------

create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_label text,                   -- e.g. "phone", "laptop"
  created_at timestamptz not null default now()
);
