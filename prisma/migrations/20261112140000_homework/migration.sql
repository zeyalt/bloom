-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "homework_from" DATE,
ADD COLUMN     "homework_note" VARCHAR(255);

-- AlterTable
ALTER TABLE "task_ticks" ADD COLUMN     "skipped" BOOLEAN NOT NULL DEFAULT false;

