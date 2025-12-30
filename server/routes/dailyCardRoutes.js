import express from 'express';
import { 
  getTodayCardGroup, 
  createTodayCardGroup, 
  getAllCardGroups,
  getGroupDetails,
  getGroupCards,
  createCardInGroup,
  updateCard,
  deleteCard
} from '../controllers/dailyCard/dailyCardGroupAndCardsOfGroupController.js';
import {
  getCard,
  getFieldMetadata,
  generateContent,
  regenerateContent,
  updateGeneration,
  updateGenerationWithImages,
  getCurrentGeneration,
  getAllGenerations,
  uploadCardImages,
} from '../controllers/dailyCard/cardGroupController.js';
// ✅ ADD: Import authorizeRoles
import { authMiddleware, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

// ✅ ADD: Protect all routes with admin role
router.use(authMiddleware);
router.use(authorizeRoles(['admin']));

// ============================================
// Card Group Routes
// ============================================
router.get('/today', getTodayCardGroup);
router.post('/create', createTodayCardGroup);
router.get('/all', getAllCardGroups);

// ⚠️ IMPORTANT: Specific routes MUST come before dynamic routes
router.get('/group/:groupId', getGroupDetails);
router.get('/group/:groupId/cards', getGroupCards);

// ============================================
// Card Routes (CRUD)
// ============================================
// ⚠️ Specific routes first, then dynamic :cardId routes
router.get('/field-metadata', getFieldMetadata);

// Card CRUD operations
router.post('/group/:groupId/cards', createCardInGroup);
router.get('/cards/:cardId', getCard);
router.put('/cards/:cardId', updateCard);
router.delete('/cards/:cardId', deleteCard);

// ============================================
// Generation Routes
// ============================================
// ⚠️ CRITICAL: Specific nested routes MUST come before generic ones
// This route handles updates WITH image uploads
router.put(
  '/cards/:cardId/generations/:generationId/with-images', 
  uploadCardImages, 
  updateGenerationWithImages
);

// This route handles updates WITHOUT image uploads
router.put(
  '/cards/:cardId/generations/:generationId', 
  updateGeneration
);

// Other generation routes
router.get('/cards/:cardId/current-generation', getCurrentGeneration);
router.get('/cards/:cardId/generations', getAllGenerations);

// Generate and regenerate routes
router.post('/cards/:cardId/generate', uploadCardImages, generateContent);
router.post('/cards/:cardId/regenerate', regenerateContent);

export default router;
