-- Feedback from the children's regular school, shown in the Journal. Additive only.
CREATE TABLE "school_notes" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "source" VARCHAR(120),
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "school_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_notes_child_id_date_idx" ON "school_notes"("child_id", "date");

ALTER TABLE "school_notes" ADD CONSTRAINT "school_notes_child_id_fkey"
    FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;
