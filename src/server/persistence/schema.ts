import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { courseConcepts, courseMaterials, courses } from "./course-schema";

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey(),
  programme: text("programme").notNull(),
  level: text("level").notNull(),
  careerInterests: text("career_interests").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const learnConversations = pgTable("learn_conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  courseId: uuid("course_id"),
  materialId: uuid("material_id"),
  conceptId: uuid("concept_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("learn_conversations_user_updated_idx").on(table.userId, table.updatedAt),
  unique("learn_conversations_id_user_unique").on(table.id, table.userId),
  check("learn_conversations_title_length_check", sql`char_length(${table.title}) between 2 and 120`),
  check("learn_conversations_grounded_context_check", sql`(${table.courseId} is null and ${table.materialId} is null and ${table.conceptId} is null) or (${table.courseId} is not null and ${table.materialId} is not null and ${table.conceptId} is not null)`),
  foreignKey({ columns: [table.courseId, table.userId], foreignColumns: [courses.id, courses.userId], name: "learn_conversations_course_owner_fk" }).onDelete("cascade"),
  foreignKey({ columns: [table.materialId, table.courseId, table.userId], foreignColumns: [courseMaterials.id, courseMaterials.courseId, courseMaterials.userId], name: "learn_conversations_material_owner_fk" }).onDelete("cascade"),
  foreignKey({ columns: [table.conceptId, table.materialId, table.userId], foreignColumns: [courseConcepts.id, courseConcepts.materialId, courseConcepts.userId], name: "learn_conversations_concept_owner_fk" }).onDelete("cascade"),
  index("learn_conversations_course_updated_idx").on(table.courseId, table.updatedAt),
]);

export const learnMessages = pgTable("learn_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").notNull(),
  userId: uuid("user_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  followUpQuestions: jsonb("follow_up_questions").$type<string[]>().notNull().default([]),
  responseSegments: jsonb("response_segments").$type<unknown[]>().notNull().default([]),
  groundingStatus: text("grounding_status").notNull().default("general"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("learn_messages_conversation_created_idx").on(table.conversationId, table.createdAt),
  index("learn_messages_user_created_idx").on(table.userId, table.createdAt),
  foreignKey({
    columns: [table.conversationId, table.userId],
    foreignColumns: [learnConversations.id, learnConversations.userId],
    name: "learn_messages_conversation_owner_fk",
  }).onDelete("cascade"),
  check("learn_messages_role_check", sql`${table.role} in ('user', 'assistant')`),
  check("learn_messages_content_length_check", sql`char_length(${table.content}) between 1 and 8000`),
  check("learn_messages_follow_up_questions_array_check", sql`jsonb_typeof(${table.followUpQuestions}) = 'array'`),
  check("learn_messages_response_segments_array_check", sql`jsonb_typeof(${table.responseSegments}) = 'array'`),
  check("learn_messages_grounding_status_check", sql`${table.groundingStatus} in ('general', 'supporting_evidence_found', 'no_sufficient_support')`),
]);

export const practiceSessions = pgTable("practice_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  problemId: integer("problem_id").notNull(),
  problemSlug: text("problem_slug").notNull(),
  topicId: text("topic_id").notNull(),
  sourceConceptId: uuid("source_concept_id"),
  mode: text("mode").notNull().default("coach"),
  status: text("status").notNull().default("in_progress"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("practice_sessions_id_user_unique").on(table.id, table.userId),
  foreignKey({ columns: [table.sourceConceptId, table.userId], foreignColumns: [courseConcepts.id, courseConcepts.userId], name: "practice_sessions_concept_owner_fk" }),
  check("practice_sessions_mode_check", sql`${table.mode} in ('hands_off', 'coach', 'tutor')`),
  check("practice_sessions_status_check", sql`${table.status} in ('in_progress', 'completed')`),
  check("practice_sessions_completion_check", sql`(${table.status} = 'completed') = (${table.completedAt} is not null)`),
  check("practice_sessions_problem_slug_check", sql`${table.problemSlug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  check("practice_sessions_topic_check", sql`${table.topicId} in ('arrays-hashing', 'two-pointers', 'stack', 'binary-search', 'linked-lists', 'trees', 'graphs-grids')`),
  index("practice_sessions_user_updated_idx").on(table.userId, table.updatedAt),
]);

export const practiceMessages = pgTable("practice_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull(),
  userId: uuid("user_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  attempt: text("attempt"),
  mode: text("mode").notNull(),
  requestType: text("request_type"),
  responsePayload: jsonb("response_payload").$type<unknown>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("practice_messages_session_created_idx").on(table.sessionId, table.createdAt, table.id),
  index("practice_messages_user_created_idx").on(table.userId, table.createdAt),
  foreignKey({ columns: [table.sessionId, table.userId], foreignColumns: [practiceSessions.id, practiceSessions.userId], name: "practice_messages_session_owner_fk" }).onDelete("cascade"),
  check("practice_messages_role_check", sql`${table.role} in ('user', 'assistant')`),
  check("practice_messages_mode_check", sql`${table.mode} in ('hands_off', 'coach', 'tutor')`),
  check("practice_messages_request_type_check", sql`${table.requestType} is null or ${table.requestType} in ('stuck', 'code_error', 'failed_test', 'explain_approach', 'walkthrough', 'dry_run', 'full_answer', 'other')`),
  check("practice_messages_content_length_check", sql`char_length(${table.content}) between 1 and 8000`),
  check("practice_messages_attempt_length_check", sql`${table.attempt} is null or char_length(${table.attempt}) <= 6000`),
  check("practice_messages_assistant_payload_check", sql`(${table.role} = 'assistant' and ${table.responsePayload} is not null and jsonb_typeof(${table.responsePayload}) = 'object') or (${table.role} = 'user' and ${table.responsePayload} is null)`),
]);

export {
  courseConceptSources,
  courseConcepts,
  courseMaterials,
  courses,
  materialChunks,
  materialPages,
} from "./course-schema";
