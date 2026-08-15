alter table public.songs
  add column if not exists songwriter_name text,
  add column if not exists songwriter_pro text,
  add column if not exists project_name text,
  add column if not exists song_split text,
  add column if not exists date_written date;

update public.songs as song
set project_name = project.name
from public.projects as project
where song.project_id = project.id
  and song.project_name is null;
