ALTER TABLE "Playlist" ADD COLUMN "epgUrl" TEXT;
ALTER TABLE "Playlist" ADD COLUMN "epgCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Playlist" ADD COLUMN "epgError" TEXT;
ALTER TABLE "Playlist" ADD COLUMN "epgSyncedAt" TIMESTAMP(3);

CREATE TABLE "Programme" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "playlistId" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "stop" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "desc" TEXT NOT NULL DEFAULT '',
    "syncId" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Programme_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Programme_playlistId_channel_stop_idx" ON "Programme"("playlistId", "channel", "stop");
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
