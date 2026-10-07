// Saeule 3 – Microlearning-Bibliothek: kurze Lernmodule inkl. Fortschritt.
// Hinweis: Die inhaltliche Produktion der Videos ist laut Disposition ein
// Nicht-Ziel; hier werden Platzhalter-Metadaten und ein Fortschritts-Tracking
// bereitgestellt.
import { Router } from 'express';
import { db } from '../db.js';
import { authRequired } from '../auth.js';

const router = Router();

function moduleTags(id) {
  return db
    .prepare(
      `SELECT t.id, t.slug, t.name_de, t.name_en, t.category
       FROM module_tags mt JOIN tags t ON t.id = mt.tag_id WHERE mt.module_id = ?`
    )
    .all(id);
}

// Bibliothek mit Fortschritt der angemeldeten Person.
router.get('/', authRequired, (req, res) => {
  const mods = db.prepare('SELECT * FROM learning_modules ORDER BY level, title_de').all();
  const list = mods.map((m) => {
    const prog = db
      .prepare('SELECT progress, completed FROM learning_progress WHERE user_id = ? AND module_id = ?')
      .get(req.user.id, m.id);
    return {
      ...m,
      tags: moduleTags(m.id),
      progress: prog?.progress ?? 0,
      completed: !!prog?.completed,
    };
  });
  res.json({ modules: list });
});

router.get('/:id', authRequired, (req, res) => {
  const m = db.prepare('SELECT * FROM learning_modules WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Modul nicht gefunden' });
  const prog = db
    .prepare('SELECT progress, completed FROM learning_progress WHERE user_id = ? AND module_id = ?')
    .get(req.user.id, m.id);
  res.json({
    module: { ...m, tags: moduleTags(m.id), progress: prog?.progress ?? 0, completed: !!prog?.completed },
  });
});

// Fortschritt setzen (0..100; 100 => abgeschlossen).
router.post('/:id/progress', authRequired, (req, res) => {
  const progress = Math.min(100, Math.max(0, Number(req.body?.progress ?? 0)));
  const completed = progress >= 100 ? 1 : 0;
  db.prepare(
    `INSERT INTO learning_progress (user_id, module_id, progress, completed, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, module_id)
     DO UPDATE SET progress = excluded.progress, completed = excluded.completed, updated_at = datetime('now')`
  ).run(req.user.id, req.params.id, progress, completed);
  res.json({ progress, completed: !!completed });
});

export default router;
