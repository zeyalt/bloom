-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "prep_task" VARCHAR(255);

-- AlterTable
ALTER TABLE "children" ADD COLUMN     "auto_promote" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "calendar_id" TEXT,
ADD COLUMN     "school_level" VARCHAR(20),
ADD COLUMN     "school_level_year" INTEGER;

-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "practice_days" VARCHAR(10),
ADD COLUMN     "practice_task" VARCHAR(255);

-- CreateTable
CREATE TABLE "school_hours" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "is_school_day" BOOLEAN NOT NULL DEFAULT false,
    "start_time" VARCHAR(5),
    "end_time" VARCHAR(5),
    "after_school" VARCHAR(255),

    CONSTRAINT "school_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_calendars" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "kind" VARCHAR(30) NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_days" (
    "id" TEXT NOT NULL,
    "calendar_id" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "kind" VARCHAR(30) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "ends_at" VARCHAR(5),
    "levels" VARCHAR(100),
    "source" VARCHAR(30) NOT NULL DEFAULT 'you',
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_items" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "day_type" VARCHAR(10) NOT NULL,
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "tier" VARCHAR(10) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "at_time" VARCHAR(5),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "routine_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_ticks" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "item_key" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "tier" VARCHAR(10) NOT NULL,
    "done_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "task_ticks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "school_hours_child_id_day_of_week_key" ON "school_hours"("child_id", "day_of_week");

-- CreateIndex
CREATE INDEX "calendar_days_start_date_idx" ON "calendar_days"("start_date");

-- CreateIndex
CREATE INDEX "routine_items_child_id_idx" ON "routine_items"("child_id");

-- CreateIndex
CREATE INDEX "task_ticks_date_idx" ON "task_ticks"("date");

-- CreateIndex
CREATE UNIQUE INDEX "task_ticks_child_id_date_item_key_key" ON "task_ticks"("child_id", "date", "item_key");

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "school_calendars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_hours" ADD CONSTRAINT "school_hours_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_days" ADD CONSTRAINT "calendar_days_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "school_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_items" ADD CONSTRAINT "routine_items_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_ticks" ADD CONSTRAINT "task_ticks_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

