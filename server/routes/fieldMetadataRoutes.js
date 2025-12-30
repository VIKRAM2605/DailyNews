import express from 'express';
import {
  getAllFields,
  getField,
  createField,
  updateField,
  deleteField
} from '../controllers/fieldMetaData/fieldMetadataController.js';
import { authMiddleware, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// GET routes - accessible by both admin and faculty
router.get('/', authorizeRoles(['admin', 'faculty']), getAllFields);
router.get('/:fieldId', authorizeRoles(['admin', 'faculty']), getField);

// Write operations - admin only
router.post('/', authorizeRoles(['admin']), createField);
router.put('/:fieldId', authorizeRoles(['admin']), updateField);
router.delete('/:fieldId', authorizeRoles(['admin']), deleteField);

export default router;
