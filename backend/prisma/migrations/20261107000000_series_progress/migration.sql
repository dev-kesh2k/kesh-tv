ALTER TABLE "Playlist" ADD COLUMN "syncProgress" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Channel" ADD COLUMN "seriesName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Channel" ADD COLUMN "season" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Channel" ADD COLUMN "episode" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "Channel_playlistId_seriesName_season_episode_idx" ON "Channel"("playlistId", "seriesName", "season", "episode");
