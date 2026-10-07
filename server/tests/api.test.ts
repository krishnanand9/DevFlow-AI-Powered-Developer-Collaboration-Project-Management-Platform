import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app';

process.env.NODE_ENV = 'test';
const app = createApp();
let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const reg = (name: string, email: string) =>
  request(app).post('/api/v1/auth/register').send({ name, email, password: 'Password123!' });

describe('auth', () => {
  it('registers, logs in, rejects bad password', async () => {
    const r = await reg('A', 'a@x.com');
    expect(r.status).toBe(201);
    expect(r.body.accessToken).toBeDefined();
    expect((await request(app).post('/api/v1/auth/login').send({ email: 'a@x.com', password: 'Password123!' })).status).toBe(200);
    expect((await request(app).post('/api/v1/auth/login').send({ email: 'a@x.com', password: 'wrong' })).status).toBe(401);
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const r = await reg('B', 'b@x.com');
    const first = r.body.refreshToken;
    const rotated = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: first });
    expect(rotated.status).toBe(200);
    expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: first })).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: rotated.body.refreshToken })).status).toBe(401);
  });

  it('protects routes', async () => {
    expect((await request(app).get('/api/v1/workspaces')).status).toBe(401);
  });
});

describe('workspace permissions and tasks', () => {
  it('enforces membership and roles', async () => {
    const owner = (await reg('Owner', 'o@x.com')).body.accessToken;
    const outsider = (await reg('Out', 'out@x.com')).body.accessToken;
    const viewerRes = await reg('View', 'v@x.com');
    const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

    const ws = (await request(app).post('/api/v1/workspaces').set(auth(owner)).send({ name: 'W' })).body;
    const proj = (await request(app).post(`/api/v1/workspaces/${ws._id}/projects`).set(auth(owner)).send({ name: 'P' })).body;
    expect(proj._id).toBeDefined();

    // outsider cannot see project or tasks
    expect((await request(app).get(`/api/v1/projects/${proj._id}`).set(auth(outsider))).status).toBe(403);
    expect((await request(app).get(`/api/v1/projects/${proj._id}/tasks`).set(auth(outsider))).status).toBe(403);

    // invite viewer
    expect((await request(app).post(`/api/v1/workspaces/${ws._id}/members`).set(auth(owner)).send({ email: 'v@x.com', role: 'viewer' })).status).toBe(201);
    const vt = viewerRes.body.accessToken;
    expect((await request(app).post(`/api/v1/projects/${proj._id}/tasks`).set(auth(vt)).send({ title: 'nope' })).status).toBe(403);

    // owner creates, updates; status -> done sets completedAt
    const t = (await request(app).post(`/api/v1/projects/${proj._id}/tasks`).set(auth(owner)).send({ title: 'Do it' })).body;
    const upd = await request(app).patch(`/api/v1/tasks/${t._id}`).set(auth(owner)).send({ status: 'done' });
    expect(upd.status).toBe(200);
    expect(upd.body.completedAt).toBeDefined();

    const metrics = await request(app).get(`/api/v1/projects/${proj._id}/analytics`).set(auth(owner));
    expect(metrics.body.completionPercent).toBe(100);
  });

  it('notifies assignee', async () => {
    const owner = await reg('O2', 'o2@x.com');
    const dev = await reg('D2', 'd2@x.com');
    const h = { Authorization: `Bearer ${owner.body.accessToken}` };
    const ws = (await request(app).post('/api/v1/workspaces').set(h).send({ name: 'W2' })).body;
    const proj = (await request(app).post(`/api/v1/workspaces/${ws._id}/projects`).set(h).send({ name: 'P2' })).body;
    await request(app).post(`/api/v1/workspaces/${ws._id}/members`).set(h).send({ email: 'd2@x.com' });
    await request(app).post(`/api/v1/projects/${proj._id}/tasks`).set(h).send({ title: 'T', assignee: dev.body.user.id });
    const n = await request(app).get('/api/v1/notifications').set({ Authorization: `Bearer ${dev.body.accessToken}` });
    expect(n.body.unread).toBeGreaterThanOrEqual(1);
  });
});
