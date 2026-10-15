import { sqliteTable, text, integer, blob, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const expeditions = sqliteTable('expeditions', {
  id: text('id').primaryKey(), title: text('title').notNull(), category: text('category').notNull(),
  date: text('date').notNull(), deadline: text('deadline').notNull(), location: text('location').notNull(),
  description: text('description').notNull(), meetingPlaces: text('meeting_places').notNull(),
  capacity: integer('capacity').notNull().default(0), status: text('status').notNull().default('open'),
  isExample: integer('is_example').notNull().default(0), createdAt: text('created_at').notNull(),
});
export const applicants = sqliteTable('applicants', {
  id: text('id').primaryKey(), eventId: text('event_id').notNull().references(() => expeditions.id),
  name: text('name').notNull(), phone: text('phone').notNull(), binoculars: integer('binoculars').notNull(),
  boots: integer('boots').notNull(), meetingPlace: text('meeting_place').notNull(), meal: integer('meal').notNull(),
  message: text('message').notNull().default(''),
  idempotencyKey: text('idempotency_key').notNull(), createdAt: text('created_at').notNull(),
}, t => [uniqueIndex('application_request_unique').on(t.idempotencyKey),
  uniqueIndex('application_person_unique').on(t.eventId, t.name, t.phone), index('application_event_index').on(t.eventId)]);
export const adminSessions = sqliteTable('admin_sessions', {
  tokenHash: text('token_hash').primaryKey(), expiresAt: integer('expires_at').notNull(),
});
export const loginAttempts = sqliteTable('login_attempts', {
  key: text('key').primaryKey(), failures: integer('failures').notNull().default(0), windowStart: integer('window_start').notNull(),
});
export const deletedExamples = sqliteTable('deleted_examples', {
  id: text('id').primaryKey(), createdAt: text('created_at').notNull(),
});
export const expeditionPhotos = sqliteTable('expedition_photos', {
  id: text('id').primaryKey(), eventId: text('event_id').notNull().references(() => expeditions.id),
  contentType: text('content_type').notNull(), data: blob('data', {mode:'buffer'}).notNull(),
  sha256: text('sha256').notNull(), size: integer('size').notNull(), createdAt: text('created_at').notNull(),
}, t => [index('expedition_photo_event_index').on(t.eventId)]);
