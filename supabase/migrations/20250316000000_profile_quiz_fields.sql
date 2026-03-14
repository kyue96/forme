-- Add quiz data fields to profiles for TDEE calculation
alter table profiles add column if not exists height text;
alter table profiles add column if not exists weight text;
alter table profiles add column if not exists goal text;
alter table profiles add column if not exists days_per_week text;
alter table profiles add column if not exists gender text;
