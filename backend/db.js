import { MongoClient, ServerApiVersion } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let connected = false;

export async function getDb() {
  if (!connected) {
    await client.connect();
    connected = true;
  }
  return client.db("game-fun");
}
