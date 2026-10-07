// Tag-Katalog (Fachgebiete, Phasen, Maerkte, Skills) fuer Auswahl-UI und Matching.
import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

router.get('/', (_req, res) => {
  const tags = db.prepare('SELECT * FROM tags ORDER BY category, name_de').all();
  res.json({ tags });
});

export default router;
