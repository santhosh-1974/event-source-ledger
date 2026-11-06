import app from "./app";
import { env } from "./config/env";
import { pool } from "./database/database";

const server = app.listen(env.PORT, () => {
  console.log(`Identity Service listening on http://localhost:${env.PORT}`);
});

// Graceful shutdown
function shutdown() {
  console.log('Shutting down Identity Service...');
  server.close(() => {
    console.log('HTTP server closed');
    pool.end(() => {
      console.log('PostgreSQL pool closed');
      process.exit(0);
    });
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
