CREATE TABLE "goal_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"tint" text DEFAULT 'plain' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "banner_tint" text;--> statement-breakpoint
ALTER TABLE "goal_cards" ADD CONSTRAINT "goal_cards_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_cards" ADD CONSTRAINT "goal_cards_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goal_cards_goal_idx" ON "goal_cards" USING btree ("goal_id","position");