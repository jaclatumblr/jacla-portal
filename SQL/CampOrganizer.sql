-- Existing databases: add the position without rerunning the full profile setup.
alter type public.position_role add value if not exists 'Camp Organizer';
notify pgrst, 'reload schema';
