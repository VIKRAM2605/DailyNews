import db from '../../utils/db.js';

// Grant edit access to a user
export const grantCardAccess = async (req, res) => {
  try {
    const { cardId } = req.params;
    const { user_email } = req.body;
    const grantedBy = req.user?.id;

    console.log('🔐 Grant access request:', { cardId, user_email, grantedBy });

    // Check if user is owner or admin
    const card = await db`
      SELECT created_by FROM cards WHERE id = ${cardId}
    `;

    if (card.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Card not found'
      });
    }

    const isOwner = card[0].created_by === grantedBy;
    const isAdmin = req.user?.role === 'admin'; // Assuming you have role in req.user

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only card owner or admin can grant access'
      });
    }

    // Find user by email
    const user = await db`
      SELECT id, name, email FROM login 
      WHERE email = ${user_email}
      LIMIT 1
    `;

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found with this email'
      });
    }

    const userId = user[0].id;

    // Check if user is already the owner
    if (userId === card[0].created_by) {
      return res.status(400).json({
        success: false,
        error: 'User is already the card owner'
      });
    }

    // Insert or update permission
    const permission = await db`
      INSERT INTO card_permissions (card_id, user_id, granted_by, can_edit)
      VALUES (${cardId}, ${userId}, ${grantedBy}, true)
      ON CONFLICT (card_id, user_id) 
      DO UPDATE SET can_edit = true, granted_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    res.json({
      success: true,
      permission: {
        ...permission[0],
        user_name: user[0].name,
        user_email: user[0].email
      },
      message: `Edit access granted to ${user[0].name}`
    });
  } catch (error) {
    console.error('❌ Grant access error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to grant access'
    });
  }
};

// Revoke edit access from a user
export const revokeCardAccess = async (req, res) => {
  try {
    const { cardId, userId } = req.params;
    const revokedBy = req.user?.id;

    // Check if user is owner or admin
    const card = await db`
      SELECT created_by FROM cards WHERE id = ${cardId}
    `;

    if (card.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Card not found'
      });
    }

    const isOwner = card[0].created_by === revokedBy;
    const isAdmin = req.user?.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only card owner or admin can revoke access'
      });
    }

    // Delete permission
    const deleted = await db`
      DELETE FROM card_permissions
      WHERE card_id = ${cardId} AND user_id = ${userId}
      RETURNING *
    `;

    if (deleted.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Permission not found'
      });
    }

    res.json({
      success: true,
      message: 'Edit access revoked'
    });
  } catch (error) {
    console.error('❌ Revoke access error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke access'
    });
  }
};

// Get all users with access to a card
export const getCardPermissions = async (req, res) => {
  try {
    const { cardId } = req.params;

    const permissions = await db`
      SELECT cp.*, u.name as user_name, u.email as user_email,
             gb.name as granted_by_name
      FROM card_permissions cp
      LEFT JOIN login u ON cp.user_id = u.id
      LEFT JOIN login gb ON cp.granted_by = gb.id
      WHERE cp.card_id = ${cardId}
      ORDER BY cp.granted_at DESC
    `;

    res.json({
      success: true,
      permissions
    });
  } catch (error) {
    console.error('❌ Get permissions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch permissions'
    });
  }
};

// Check if user has edit access to a card
export const checkCardAccess = async (req, res) => {
  try {
    const { cardId } = req.params;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    // Admin has access to everything
    if (isAdmin) {
      return res.json({
        success: true,
        has_access: true,
        is_owner: false,
        is_admin: true
      });
    }

    // Check if user is owner
    const card = await db`
      SELECT created_by FROM cards WHERE id = ${cardId}
    `;

    if (card.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Card not found'
      });
    }

    const isOwner = card[0].created_by === userId;

    if (isOwner) {
      return res.json({
        success: true,
        has_access: true,
        is_owner: true,
        is_admin: false
      });
    }

    // Check if user has explicit permission
    const permission = await db`
      SELECT can_edit FROM card_permissions
      WHERE card_id = ${cardId} AND user_id = ${userId}
      LIMIT 1
    `;

    const hasAccess = permission.length > 0 && permission[0].can_edit;

    res.json({
      success: true,
      has_access: hasAccess,
      is_owner: false,
      is_admin: false
    });
  } catch (error) {
    console.error('❌ Check access error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check access'
    });
  }
};
// Get all available users (for autocomplete in share modal)
export const getAvailableUsers = async (req, res) => {
  try {
    const { cardId } = req.params;
    const currentUserId = req.user?.id;

    // Get card owner
    const card = await db`
      SELECT created_by FROM cards WHERE id = ${cardId}
    `;

    if (card.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Card not found'
      });
    }

    const cardOwnerId = card[0].created_by;

    // Get all users who already have access
    const usersWithAccess = await db`
      SELECT user_id FROM card_permissions
      WHERE card_id = ${cardId}
    `;

    const excludedUserIds = [cardOwnerId, ...usersWithAccess.map(p => p.user_id)];

    // Get all users except owner and those with existing access
    const availableUsers = await db`
      SELECT id, name, email, role
      FROM login
      WHERE id != ALL(${excludedUserIds})
      ORDER BY name ASC
    `;

    res.json({
      success: true,
      users: availableUsers
    });
  } catch (error) {
    console.error('❌ Get available users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available users'
    });
  }
};
