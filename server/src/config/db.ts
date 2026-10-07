import mongoose from 'mongoose';
import { env } from './env';

export async function connectDb(uri = env.mongoUri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
}
