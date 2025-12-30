import express from 'express';
import {
  getAllUsers,
  getPendingUsers,
  getUser,
  approveUser,
  rejectUser,
  updateUserRole,
  createUser,
  deleteUser
} from '../controllers/userValidation/userController.js';
// ✅ ADD: Import auth middleware
import { authMiddleware, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

// ✅ Protect all routes with admin role
router.use(authMiddleware);
router.use(authorizeRoles(['admin']));

// All routes will be prefixed with /api/users
router.get('/', getAllUsers);
router.get('/pending', getPendingUsers);
router.get('/:userId', getUser);
router.post('/', createUser);
router.put('/:userId/approve', approveUser);
router.put('/:userId/role', updateUserRole);
router.delete('/:userId/reject', rejectUser);
router.delete('/:userId', deleteUser);

export default router;
