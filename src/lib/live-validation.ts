import { z } from "zod";
import { isValidISODate } from "@/lib/date";

const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const text = z.string().trim().min(1).max(3000);
const status = z.enum(["belum", "dikerjakan", "terhambat", "selesai"]);
const member = z.object({ id, name: z.string().trim().min(2).max(100), role: z.string().max(120),
  accent: z.enum(["teal", "amber", "violet", "sky", "rose", "emerald", "indigo", "orange"]),
  active: z.boolean().optional() });
const task = z.object({ id, title: text, assigneeIds: z.array(id).min(1).max(40), project: z.string().max(200).optional(),
  dueDate: z.string().refine(isValidISODate).optional(), notes: z.string().max(5000).optional(), status,
  createdAt: z.string().datetime(), statusHistory: z.array(z.object({ id, status, at: z.string().datetime(), note: z.string().max(3000).optional() })).max(200),
});
export const roomCreateSchema = z.object({
  title: z.string().trim().min(3).max(100), date: z.string().refine(isValidISODate, "Tanggal tidak valid"),
  members: z.array(member).min(1).max(40), tasks: z.array(task).max(200), withDemo: z.boolean().default(false),
}).refine(v => new Set(v.members.map(m => m.id)).size === v.members.length, "ID anggota harus unik");
export const liveActivitySchema = z.object({
  id, memberId: id, text, kind: z.enum(["plan", "done", "blocker"]),
  taskId: id.optional(), createTask: z.boolean(), messageId: id.optional(), origin: z.enum(["transcript", "manual"]),
});
export const roomActionSchema = z.object({
  revision: z.number().int().nonnegative(),
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("message"), message: z.object({ id, memberId: id, text, source: z.enum(["typed", "voice", "demo"]) }) }),
    z.object({ type: z.literal("upsert"), activity: liveActivitySchema }),
    z.object({ type: z.literal("remove"), activityId: id }),
    z.object({ type: z.literal("phase"), phase: z.enum(["active", "review", "published"]) }),
  ]),
});
