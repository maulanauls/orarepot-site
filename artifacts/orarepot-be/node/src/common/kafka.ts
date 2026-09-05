import { readFileSync } from 'fs';
import { Kafka, KafkaConfig, logLevel, SASLOptions } from 'kafkajs';

export function kafkaBrokers(): string[] {
  return (process.env.KAFKA_BROKERS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function createKafka(clientId: string): Kafka | null {
  const brokers = kafkaBrokers();
  if (!brokers.length) return null;

  const config: KafkaConfig = {
    clientId,
    brokers,
    connectionTimeout: 10_000,
    requestTimeout: 30_000,
    logLevel: logLevel.ERROR,
  };

  const username = process.env.KAFKA_USERNAME;
  const password = process.env.KAFKA_PASSWORD;
  if (username && password) {
    const raw = (process.env.KAFKA_SASL_MECHANISM ?? 'plain').toLowerCase();
    const mechanism =
      raw === 'scram-sha-256' ? 'scram-sha-256' : raw === 'scram-sha-512' ? 'scram-sha-512' : 'plain';
    config.sasl = { mechanism, username, password } as SASLOptions;
  }

  if (process.env.KAFKA_SSL === 'true' || process.env.KAFKA_SSL === '1') {
    const caPath = process.env.KAFKA_SSL_CA;
    config.ssl = caPath ? { ca: readFileSync(caPath, 'utf8') } : true;
  }

  return new Kafka(config);
}
