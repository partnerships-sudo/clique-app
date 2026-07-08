-- Store external API IDs alongside logged items so we can fetch
-- "similar" / "recommendations" from TMDB, RAWG, and Google Books.
--
-- external_id: the API's own identifier (TMDB movie/show ID, RAWG game ID,
--              Google Books volume ID, Spotify album/show ID)
-- media_type:  the sub-kind ('movie', 'tv', 'game', 'book', 'album', 'podcast')
--              so we know which endpoint to call when fetching recommendations.

alter table posts add column if not exists external_id text;
alter table posts add column if not exists media_type  text;

alter table library add column if not exists external_id text;
alter table library add column if not exists media_type  text;
