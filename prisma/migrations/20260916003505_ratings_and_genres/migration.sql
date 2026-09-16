-- CreateEnum
CREATE TYPE "RatingValue" AS ENUM ('LOVED', 'LIKED', 'NOT_SEEN', 'DISLIKED', 'HATED');

-- AlterTable
ALTER TABLE "Title" ADD COLUMN     "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "priorPopularity" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "tagline" TEXT;

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "value" "RatingValue" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rating_userId_value_idx" ON "Rating"("userId", "value");

-- CreateIndex
CREATE INDEX "Rating_titleId_idx" ON "Rating"("titleId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_userId_titleId_key" ON "Rating"("userId", "titleId");

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;
