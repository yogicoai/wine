import { MongoClient } from "mongodb";

let clientPromise = null;

export function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  if (!clientPromise) {
    // dev 핫리로드에서 커넥션 누수 방지
    if (process.env.NODE_ENV === "development") {
      if (!global._wlMongoPromise) {
        global._wlMongoPromise = new MongoClient(uri).connect();
      }
      clientPromise = global._wlMongoPromise;
    } else {
      clientPromise = new MongoClient(uri).connect();
    }
  }
  return clientPromise.then((c) => c.db(process.env.MONGODB_DB || "winelens"));
}
