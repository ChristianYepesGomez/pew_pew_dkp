// Test environment setup — must run before any imports
process.env.TURSO_DATABASE_URL = 'file:./data/test.db';
process.env.JWT_SECRET = 'test-secret-key-do-not-use-in-prod';
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // random port
