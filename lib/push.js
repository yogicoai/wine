// 웹 푸시 — 앱을 닫아 두어도 특가 알림을 받을 수 있게 한다.
// 브라우저별 푸시 서버로 전송하며, VAPID 키 한 쌍으로 발신자를 증명한다.
import webpush from "web-push";
import { getDb } from "./mongodb";
import { env } from "./env";

let configured = false;

export function pushConfigured() {
  return !!(env("VAPID_PUBLIC_KEY") && env("VAPID_PRIVATE_KEY"));
}

function setup() {
  if (configured || !pushConfigured()) return pushConfigured();
  webpush.setVapidDetails(
    env("VAPID_SUBJECT", "mailto:admin@bottlelens.app"),
    env("VAPID_PUBLIC_KEY"),
    env("VAPID_PRIVATE_KEY")
  );
  configured = true;
  return true;
}

export async function saveSubscription(subscription) {
  const db = await getDb();
  if (!db || !subscription?.endpoint) return false;
  await db.collection("push_subs").updateOne(
    { endpoint: subscription.endpoint },
    { $set: { ...subscription, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );
  return true;
}

export async function removeSubscription(endpoint) {
  const db = await getDb();
  if (!db || !endpoint) return false;
  await db.collection("push_subs").deleteOne({ endpoint });
  return true;
}

export async function subscriptionCount() {
  const db = await getDb();
  if (!db) return 0;
  return db.collection("push_subs").countDocuments();
}

/**
 * 모든 구독자에게 알림을 보낸다.
 * 만료된 구독(404/410)은 자동으로 정리한다.
 */
export async function sendToAll(payload) {
  if (!setup()) return { sent: 0, skipped: "noVapid" };
  const db = await getDb();
  if (!db) return { sent: 0, skipped: "noDb" };

  const subs = await db.collection("push_subs").find({}).toArray();
  let sent = 0;
  let removed = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify(payload)
        );
        sent++;
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await db.collection("push_subs").deleteOne({ endpoint: sub.endpoint });
          removed++;
        }
      }
    })
  );

  return { sent, removed, total: subs.length };
}
