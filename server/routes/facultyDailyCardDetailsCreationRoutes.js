import express from 'express';
import {
  getFacultyCardGroups,
  getFacultyGroupDetails,
  getFacultyGroupCards,
  createFacultyCard,
  getFacultyCardDetails,
  updateFacultyCardContent
} from '../controllers/dailyCard/facultyDailyCardDetailsCreationController.js';

import { checkCardAccess } from '../controllers/cardPermission/cardPermissionsController.js';
import { authMiddleware, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require authentication and faculty role
router.use(authMiddleware);
router.use(authorizeRoles(['faculty']));

// Get all card groups (faculty view)
router.get('/groups', getFacultyCardGroups);

// Get single group details
router.get('/group/:groupId', getFacultyGroupDetails);

// Get cards in a group
router.get('/group/:groupId/cards', getFacultyGroupCards);

// Create card (only for TODAY)
router.post('/group/:groupId/cards', createFacultyCard);

// Check permission for a single card (used by frontend before editing)
router.get('/card/:cardId/check-permission', checkCardAccess);

// Get single card details
router.get('/card/:cardId', getFacultyCardDetails);

// Update card content (only for TODAY, with permission check)
router.put('/card/:cardId/content', updateFacultyCardContent);

export default router;
