process.env.DATABASE_URL ??= 'postgresql://railflow:railflow@localhost:5432/railflow?schema=railflow_test';
process.env.REDIS_URL ??= 'redis://localhost:6379/1';
process.env.ELASTICSEARCH_URL ??= 'http://localhost:9200';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-with-at-least-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-with-at-least-32-characters';
process.env.PAYMENT_WEBHOOK_SECRET ??= 'test-webhook-secret-with-at-least-32-characters';
