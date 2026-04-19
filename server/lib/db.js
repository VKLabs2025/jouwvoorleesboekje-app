// SQLite data layer voor orders en invoices
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'db')
  : path.resolve(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'app.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  purchase_type TEXT NOT NULL,
  child_first_name TEXT,
  child_age INTEGER,
  age_segment TEXT,
  theme TEXT,
  story_tone TEXT,
  illustration_style TEXT,
  favorite_animal TEXT,
  hobby TEXT,
  friend_name TEXT,
  moral TEXT,
  sender_note TEXT,
  parent_email TEXT,
  consent_privacy INTEGER,
  consent_digital_delivery INTEGER,
  payment_status TEXT DEFAULT 'pending',
  mollie_payment_id TEXT,
  generation_status TEXT DEFAULT 'idle',
  generation_error TEXT,
  generated_story_title TEXT,
  generated_pages_json TEXT,
  character_sheet_json TEXT,
  pdf_path TEXT,
  delivered_at INTEGER,
  deleted_at INTEGER,
  email_preview_html TEXT
);

CREATE TABLE IF NOT EXISTS invoices (
  order_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  amount REAL NOT NULL,
  btw REAL NOT NULL,
  paid_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(generation_status);
`);

// Helper conversions
export function rowToOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.created_at,
    purchaseType: row.purchase_type,
    childFirstName: row.child_first_name,
    childAge: row.child_age,
    ageSegment: row.age_segment,
    theme: row.theme,
    storyTone: row.story_tone,
    illustrationStyle: row.illustration_style,
    favoriteAnimal: row.favorite_animal,
    hobby: row.hobby,
    friendName: row.friend_name,
    moral: row.moral,
    senderNote: row.sender_note,
    parentEmail: row.parent_email,
    consentPrivacy: !!row.consent_privacy,
    consentDigitalDelivery: !!row.consent_digital_delivery,
    paymentStatus: row.payment_status,
    molliePaymentId: row.mollie_payment_id,
    generationStatus: row.generation_status,
    generationError: row.generation_error,
    generatedStoryTitle: row.generated_story_title,
    generatedPages: row.generated_pages_json ? JSON.parse(row.generated_pages_json) : null,
    characterSheet: row.character_sheet_json ? JSON.parse(row.character_sheet_json) : null,
    pdfPath: row.pdf_path,
    deliveredAt: row.delivered_at,
    deletedAt: row.deleted_at,
    emailPreviewHtml: row.email_preview_html,
  };
}

export function createOrder(o) {
  db.prepare(`INSERT INTO orders (
    id, created_at, purchase_type, child_first_name, child_age, age_segment,
    theme, story_tone, illustration_style, favorite_animal, hobby, friend_name,
    moral, sender_note, parent_email, consent_privacy, consent_digital_delivery
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    o.id, o.createdAt, o.purchaseType, o.childFirstName, o.childAge, o.ageSegment,
    o.theme, o.storyTone, o.illustrationStyle, o.favoriteAnimal, o.hobby, o.friendName,
    o.moral, o.senderNote, o.parentEmail, o.consentPrivacy ? 1 : 0, o.consentDigitalDelivery ? 1 : 0
  );
}

export function getOrder(id) {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  return rowToOrder(row);
}

export function updateOrder(id, patch) {
  const fields = [];
  const values = [];
  const map = {
    paymentStatus: 'payment_status',
    molliePaymentId: 'mollie_payment_id',
    generationStatus: 'generation_status',
    generationError: 'generation_error',
    generatedStoryTitle: 'generated_story_title',
    generatedPages: 'generated_pages_json',
    characterSheet: 'character_sheet_json',
    pdfPath: 'pdf_path',
    deliveredAt: 'delivered_at',
    deletedAt: 'deleted_at',
    emailPreviewHtml: 'email_preview_html',
  };
  for (const [k, v] of Object.entries(patch)) {
    const col = map[k];
    if (!col) continue;
    fields.push(`${col} = ?`);
    if (k === 'generatedPages' || k === 'characterSheet') {
      values.push(v == null ? null : JSON.stringify(v));
    } else {
      values.push(v);
    }
  }
  if (!fields.length) return;
  values.push(id);
  db.prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function listRecentOrders(limit = 50) {
  const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT ?').all(limit);
  return rows.map(rowToOrder);
}

export function createInvoice(inv) {
  db.prepare(`INSERT OR REPLACE INTO invoices (order_id, email, amount, btw, paid_at)
    VALUES (?, ?, ?, ?, ?)`).run(inv.orderId, inv.email, inv.amount, inv.btw, inv.paidAt);
}

export function deleteChildDataOlderThan(cutoffMs) {
  const result = db.prepare(`UPDATE orders SET
    child_first_name = NULL, child_age = NULL, age_segment = NULL,
    favorite_animal = NULL, hobby = NULL, friend_name = NULL, moral = NULL,
    sender_note = NULL, generated_pages_json = NULL, character_sheet_json = NULL,
    deleted_at = ?
    WHERE created_at < ? AND deleted_at IS NULL`).run(Date.now(), cutoffMs);
  return result.changes;
}

export function deletePdfsOlderThan(cutoffMs) {
  const rows = db.prepare('SELECT id, pdf_path FROM orders WHERE pdf_path IS NOT NULL AND created_at < ?').all(cutoffMs);
  return rows;
}
