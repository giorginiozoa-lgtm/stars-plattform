// Einstiegspunkt der Backend-API der stars Community-Plattform.
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

import { db, initSchema, DB_PATH } from './db.js';
import { startBackups } from './backup.js';
import authRoutes from './routes/auth.js';
import tagRoutes from './routes/tags.js';
import forumRoutes from './routes/forums.js';
import questionRoutes from './routes/questions.js';
import mentorRoutes from './routes/mentors.js';
import messageRoutes from './routes/messages.js';
import learningRoutes from './routes/learning.js';
import dashboardRoutes from './routes/dashboard.js';
import notificationRoutes from './routes/notifications.js';
import journeyRoutes from './routes/journey.js';
import communityRoutes from './routes/communities.js';
import introRoutes from './routes/intros.js';
import eventRoutes from './routes/events.js';
import feedbackRoutes from './routes/feedback.js';
import userRoutes from './routes/users.js';
import analyticsRoutes from './routes/analytics.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

initSchema();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(startBackups(db, DB_PATH)); // nur aktiv, wenn BACKUP_REPO/BACKUP_TOKEN gesetzt sind

app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/forums', forumRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/mentors', mentorRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/journey', journeyRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/intros', introRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analytics', analyticsRoutes);

// In Produktion (nach `npm run build`) das gebaute Frontend ausliefern.
const clientDist = join(__dirname, '..', '..', 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(join(clientDist, 'index.html'));
  });
}

// Zentraler Fehler-Handler.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Interner Serverfehler' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`stars API läuft auf http://localhost:${PORT}`);
});
