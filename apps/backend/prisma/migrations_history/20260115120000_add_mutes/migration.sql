-- CreateTable: UserMute
CREATE TABLE "user_mutes" (
    "id" TEXT NOT NULL,
    "muterId" TEXT NOT NULL,
    "mutedId" TEXT NOT NULL,
    "muteNotifications" BOOLEAN NOT NULL DEFAULT true,
    "duration" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_mutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WordMute
CREATE TABLE "word_mutes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyword" VARCHAR(255) NOT NULL,
    "regex" BOOLEAN NOT NULL DEFAULT false,
    "wholeWord" BOOLEAN NOT NULL DEFAULT false,
    "caseSensitive" BOOLEAN NOT NULL DEFAULT false,
    "duration" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "word_mutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TagMute
CREATE TABLE "tag_mutes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "duration" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_mutes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: UserMute
CREATE UNIQUE INDEX "user_mutes_muterId_mutedId_key" ON "user_mutes"("muterId", "mutedId");
CREATE INDEX "user_mutes_muterId_idx" ON "user_mutes"("muterId");
CREATE INDEX "user_mutes_mutedId_idx" ON "user_mutes"("mutedId");
CREATE INDEX "user_mutes_expiresAt_idx" ON "user_mutes"("expiresAt");

-- CreateIndex: WordMute
CREATE INDEX "word_mutes_userId_idx" ON "word_mutes"("userId");
CREATE INDEX "word_mutes_expiresAt_idx" ON "word_mutes"("expiresAt");

-- CreateIndex: TagMute
CREATE UNIQUE INDEX "tag_mutes_userId_tagId_key" ON "tag_mutes"("userId", "tagId");
CREATE INDEX "tag_mutes_userId_idx" ON "tag_mutes"("userId");
CREATE INDEX "tag_mutes_tagId_idx" ON "tag_mutes"("tagId");
CREATE INDEX "tag_mutes_expiresAt_idx" ON "tag_mutes"("expiresAt");

-- AddForeignKey: UserMute
ALTER TABLE "user_mutes" ADD CONSTRAINT "user_mutes_muterId_fkey" FOREIGN KEY ("muterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_mutes" ADD CONSTRAINT "user_mutes_mutedId_fkey" FOREIGN KEY ("mutedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: WordMute
ALTER TABLE "word_mutes" ADD CONSTRAINT "word_mutes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: TagMute
ALTER TABLE "tag_mutes" ADD CONSTRAINT "tag_mutes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tag_mutes" ADD CONSTRAINT "tag_mutes_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
