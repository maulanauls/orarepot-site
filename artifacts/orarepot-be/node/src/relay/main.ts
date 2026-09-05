import { Client } from 'pg';
import { createKafka } from '../common/kafka';

const DBS = [
  'orarepot_identity',
  'orarepot_members',
  'orarepot_merchant',
  'orarepot_billing',
  'orarepot_templates',
  'orarepot_otp',
  'orarepot_developer',
];

async function main() {
  const kafka = createKafka('orarepot-outbox-relay');
  if (!kafka) {
    throw new Error('KAFKA_BROKERS is required');
  }
  const producer = kafka.producer();
  await producer.connect();
  console.log('outbox relay connected');

  const clients = DBS.map((database) => {
    const client = new Client({
      host: process.env.PGHOST ?? 'localhost',
      port: Number(process.env.PGPORT ?? 5432),
      user: process.env.PGUSER ?? 'orarepot',
      password: process.env.PGPASSWORD ?? 'orarepot',
      database,
    });
    return { database, client };
  });
  for (const c of clients) {
    await c.client.connect();
  }

  async function tick() {
    for (const { client } of clients) {
      const res = await client.query<{
        id: string;
        topic: string;
        payload: unknown;
      }>(
        `SELECT id, topic, payload FROM cm_outbox
         WHERE published_at IS NULL
         ORDER BY created_at ASC
         LIMIT 50`,
      );
      for (const row of res.rows) {
        await producer.send({
          topic: row.topic,
          messages: [{ key: row.id, value: JSON.stringify(row.payload) }],
        });
        await client.query(`UPDATE cm_outbox SET published_at = now() WHERE id = $1`, [row.id]);
      }
    }
  }

  setInterval(() => {
    tick().catch((err) => console.error(err));
  }, 1500);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
