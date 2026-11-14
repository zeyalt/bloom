-- Focus points: the "how" under each action-plan checkpoint. Additive only.
CREATE TABLE "goal_focus" (
    "id" TEXT NOT NULL,
    "checkpoint_id" TEXT NOT NULL,
    "text" VARCHAR(300) NOT NULL,
    "got_date" DATE,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_focus_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "goal_focus_checkpoint_id_idx" ON "goal_focus"("checkpoint_id");

ALTER TABLE "goal_focus" ADD CONSTRAINT "goal_focus_checkpoint_id_fkey"
    FOREIGN KEY ("checkpoint_id") REFERENCES "goal_checkpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
