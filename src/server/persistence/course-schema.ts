import { sql } from "drizzle-orm";
import { check, customType, foreignKey, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

const vector768 = customType<{ data: number[]; driverData: string }>({
  dataType: () => "vector(768)",
  toDriver: (value) => `[${value.join(",")}]`,
  fromDriver: (value) => value.slice(1, -1).split(",").map(Number),
});

export const courses = pgTable("courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  courseCode: text("course_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("courses_id_user_unique").on(table.id, table.userId),
  index("courses_user_updated_idx").on(table.userId, table.updatedAt),
  check("courses_title_length_check", sql`char_length(${table.title}) between 2 and 120`),
  check("courses_code_length_check", sql`${table.courseCode} is null or char_length(${table.courseCode}) <= 40`),
]);

export const courseMaterials = pgTable("course_materials", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  courseId: uuid("course_id").notNull(),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  storagePath: text("storage_path"),
  status: text("status").notNull().default("queued"),
  failureCode: text("failure_code"),
  processingAttempts: integer("processing_attempts").notNull().default(0),
  manualRetryCount: integer("manual_retry_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("course_materials_id_user_unique").on(table.id, table.userId),
  unique("course_materials_id_course_user_unique").on(table.id, table.courseId, table.userId),
  foreignKey({
    columns: [table.courseId, table.userId],
    foreignColumns: [courses.id, courses.userId],
    name: "course_materials_course_owner_fk",
  }).onDelete("cascade"),
  index("course_materials_course_created_idx").on(table.courseId, table.createdAt),
  check("course_materials_title_length_check", sql`char_length(${table.title}) between 1 and 180`),
  check("course_materials_kind_check", sql`${table.kind} in ('pdf', 'notes')`),
  check("course_materials_status_check", sql`${table.status} in ('queued', 'processing', 'ready', 'failed')`),
  check("course_materials_storage_check", sql`(${table.kind} = 'pdf' and ${table.storagePath} is not null) or (${table.kind} = 'notes' and ${table.storagePath} is null)`),
  check("course_materials_attempts_check", sql`${table.processingAttempts} >= 0`),
  check("course_materials_manual_retry_count_check", sql`${table.manualRetryCount} >= 0`),
]);

export const materialPages = pgTable("material_pages", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  courseId: uuid("course_id").notNull(),
  materialId: uuid("material_id").notNull(),
  pageNumber: integer("page_number").notNull(),
  sectionLabel: text("section_label"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("material_pages_id_user_unique").on(table.id, table.userId),
  unique("material_pages_material_page_unique").on(table.materialId, table.pageNumber),
  foreignKey({
    columns: [table.materialId, table.courseId, table.userId],
    foreignColumns: [courseMaterials.id, courseMaterials.courseId, courseMaterials.userId],
    name: "material_pages_material_owner_fk",
  }).onDelete("cascade"),
  index("material_pages_material_page_idx").on(table.materialId, table.pageNumber),
  check("material_pages_page_number_check", sql`${table.pageNumber} > 0`),
  check("material_pages_content_length_check", sql`char_length(${table.content}) <= 500000`),
]);

export const materialChunks = pgTable("material_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  courseId: uuid("course_id").notNull(),
  materialId: uuid("material_id").notNull(),
  ordinal: integer("ordinal").notNull(),
  pageStart: integer("page_start").notNull(),
  pageEnd: integer("page_end").notNull(),
  content: text("content").notNull(),
  embedding: vector768("embedding"),
  embeddingModel: text("embedding_model"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("material_chunks_id_user_unique").on(table.id, table.userId),
  unique("material_chunks_id_material_user_unique").on(table.id, table.materialId, table.userId),
  unique("material_chunks_material_ordinal_unique").on(table.materialId, table.ordinal),
  foreignKey({
    columns: [table.materialId, table.courseId, table.userId],
    foreignColumns: [courseMaterials.id, courseMaterials.courseId, courseMaterials.userId],
    name: "material_chunks_material_owner_fk",
  }).onDelete("cascade"),
  index("material_chunks_material_ordinal_idx").on(table.materialId, table.ordinal),
  check("material_chunks_ordinal_check", sql`${table.ordinal} >= 0`),
  check("material_chunks_page_range_check", sql`${table.pageStart} > 0 and ${table.pageEnd} >= ${table.pageStart}`),
  check("material_chunks_content_length_check", sql`char_length(${table.content}) between 1 and 12000`),
  check("material_chunks_embedding_pair_check", sql`(${table.embedding} is null) = (${table.embeddingModel} is null)`),
]);

export const courseConcepts = pgTable("course_concepts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  courseId: uuid("course_id").notNull(),
  materialId: uuid("material_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  ordinal: integer("ordinal").notNull(),
  extractionVersion: text("extraction_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("course_concepts_id_user_unique").on(table.id, table.userId),
  unique("course_concepts_id_material_user_unique").on(table.id, table.materialId, table.userId),
  unique("course_concepts_material_ordinal_unique").on(table.materialId, table.ordinal),
  foreignKey({
    columns: [table.materialId, table.courseId, table.userId],
    foreignColumns: [courseMaterials.id, courseMaterials.courseId, courseMaterials.userId],
    name: "course_concepts_material_owner_fk",
  }).onDelete("cascade"),
  index("course_concepts_material_ordinal_idx").on(table.materialId, table.ordinal),
  check("course_concepts_title_length_check", sql`char_length(${table.title}) between 2 and 120`),
  check("course_concepts_description_length_check", sql`char_length(${table.description}) between 1 and 1000`),
  check("course_concepts_ordinal_check", sql`${table.ordinal} >= 0`),
]);

export const courseConceptSources = pgTable("course_concept_sources", {
  userId: uuid("user_id").notNull(),
  materialId: uuid("material_id").notNull(),
  conceptId: uuid("concept_id").notNull(),
  chunkId: uuid("chunk_id").notNull(),
}, (table) => [
  foreignKey({
    columns: [table.conceptId, table.materialId, table.userId],
    foreignColumns: [courseConcepts.id, courseConcepts.materialId, courseConcepts.userId],
    name: "course_concept_sources_concept_owner_fk",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.chunkId, table.materialId, table.userId],
    foreignColumns: [materialChunks.id, materialChunks.materialId, materialChunks.userId],
    name: "course_concept_sources_chunk_owner_fk",
  }).onDelete("cascade"),
  unique("course_concept_sources_concept_chunk_unique").on(table.conceptId, table.chunkId),
  index("course_concept_sources_chunk_idx").on(table.chunkId),
]);
