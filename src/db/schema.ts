import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { LiveSession, PublishedReport } from "@/lib/live";
import type { AppState } from "@/lib/types";

/** Capability-protected demo rooms. No external AI or communication service. */
export const liveRooms = pgTable("standup_live_rooms", {
  id: uuid("id").primaryKey(),
  tokenHash: text("token_hash").notNull(),
  viewToken: text("view_token").notNull(),
  session: jsonb("session").$type<LiveSession>().notNull(),
  report: jsonb("report").$type<PublishedReport>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Satu workspace standup per tim (belum ada akun). Revisi untuk cek tulis-serentak. */
export const workspace = pgTable("standup_workspace", {
  id: text("id").primaryKey(),
  revision: integer("revision").notNull(),
  state: jsonb("state").$type<AppState>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Akun login internal. admin = koordinator (kelola akun, muat ulang riwayat). */
export const users = pgTable("standup_users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("member"),
  /** Divisi/departemen akun, mis. "Engineering", "Product". */
  division: text("division").notNull().default("M2MPD"),
  /** Terhubung ke anggota tim di workspace (id member); null untuk koordinator murni. */
  memberId: text("member_id"),
  active: boolean("active").notNull().default(true),
  passwordChanged: boolean("password_changed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Sesi login cookie; hanya hash token yang disimpan. */
export const authSessions = pgTable("standup_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/** Tautan berbagi laporan tanpa login: id pendek alfanumerik + kunci acak (hanya hash disimpan). */
export const shares = pgTable("standup_shares", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull(),
  start: text("start").notNull(),
  end: text("end").notNull(),
  groupBy: text("group_by").notNull().default("member"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
