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
// ✅ ADD: Import permission controllers
import {
  grantCardAccess,
  revokeCardAccess,
  getCardPermissions,
  checkCardAccess,
  getAvailableUsers 
} from '../controllers/cardPermission/cardPermissionsController.js';
import { authMiddleware, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);
router.use(authorizeRoles(['admin']));

// ============================================
// Card Group Routes
// ============================================
router.get('/today', getTodayCardGroup);
router.post('/create', createTodayCardGroup);
router.get('/all', getAllCardGroups);

router.get('/group/:groupId', getGroupDetails);
router.get('/group/:groupId/cards', getGroupCards);

// ============================================
// Card Routes (CRUD)
// ============================================
router.get('/field-metadata', getFieldMetadata);

router.post('/group/:groupId/cards', createCardInGroup);
router.get('/cards/:cardId', getCard);
router.put('/cards/:cardId', updateCard);
router.delete('/cards/:cardId', deleteCard);

// ============================================
// ✅ Card Permission Routes
// ============================================
router.post('/cards/:cardId/grant-access', grantCardAccess);
router.delete('/cards/:cardId/revoke-access/:userId', revokeCardAccess);
router.get('/cards/:cardId/permissions', getCardPermissions);
router.get('/cards/:cardId/check-access', checkCardAccess);
router.get('/cards/:cardId/available-users', getAvailableUsers);


// ============================================
// Generation Routes
// ============================================
router.put(
  '/cards/:cardId/generations/:generationId/with-images', 
  uploadCardImages, 
  updateGenerationWithImages
);

router.put(
  '/cards/:cardId/generations/:generationId', 
  updateGeneration
);

router.get('/cards/:cardId/current-generation', getCurrentGeneration);
router.get('/cards/:cardId/generations', getAllGenerations);

router.post('/cards/:cardId/generate', uploadCardImages, generateContent);
router.post('/cards/:cardId/regenerate', regenerateContent);

export default router;
