create extension if not exists pgcrypto;

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  colour text not null,
  pin_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text,
  tier int not null check (tier in (1, 2, 3)),
  created_at timestamptz not null default now()
);

create table if not exists team_squad_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  position text not null,
  squad_role text not null default 'player' check (squad_role in ('player', 'manager')),
  shirt_number int,
  source_url text not null,
  created_at timestamptz not null default now(),
  unique(team_id, name, squad_role)
);

create table if not exists draft_state (
  id int primary key,
  player_order jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists draft_picks (
  id uuid primary key default gen_random_uuid(),
  overall_pick int not null unique,
  round int not null,
  player_id uuid not null references players(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(team_id)
);

create table if not exists team_progress (
  team_id uuid primary key references teams(id) on delete cascade,
  group_wins int not null default 0,
  group_draws int not null default 0,
  qualified_r32 boolean not null default false,
  qualified_r16 boolean not null default false,
  reached_qf boolean not null default false,
  reached_sf boolean not null default false,
  reached_final boolean not null default false,
  won_tournament boolean not null default false,
  updated_at timestamptz not null default now(),
  check (group_wins >= 0 and group_wins <= 3),
  check (group_draws >= 0 and group_draws <= 3)
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  fd_id int unique,
  stage text not null,
  group_name text,
  kickoff_utc timestamptz not null,
  home_team_id uuid references teams(id) on delete set null,
  away_team_id uuid references teams(id) on delete set null,
  home_placeholder text,
  away_placeholder text,
  home_score int,
  away_score int,
  winner_team_id uuid references teams(id) on delete set null,
  status text not null default 'scheduled' check (status in ('scheduled', 'finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
