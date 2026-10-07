import http from 'http';
import { connectDb } from './config/db';
import { env } from './config/env';
import { createApp } from './app';
import { attachSocket } from './socket';

(async () => {
  await connectDb();
  const server = http.createServer(createApp());
  attachSocket(server);
  server.listen(env.port, () => console.log(`DevFlow API listening on :${env.port}`));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
