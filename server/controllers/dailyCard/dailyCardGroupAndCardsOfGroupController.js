import db from '../../utils/db.js';

// Get today's card group
export const getTodayCardGroup = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const cardGroup = await db`
      SELECT cg.*, u.name as creator_name,
             (SELECT COUNT(*) FROM cards WHERE card_group_id = cg.id) as card_count
      FROM card_groups cg
      LEFT JOIN login u ON cg.created_by = u.id
      WHERE cg.group_date = ${today}
      ORDER BY cg.created_at DESC
      LIMIT 1
    `;

    if (cardGroup.length === 0) {
      return res.json({ 
        success: true, 
        exists: false, 
        date: today 
      });
    }

    // Get cards in this group
    const cards = await db`
      SELECT * FROM cards 
      WHERE card_group_id = ${cardGroup[0].id}
      ORDER BY created_at ASC
    `;

    res.json({ 
      success: true, 
      exists: true, 
      cardGroup: {
        ...cardGroup[0],
        cards
      }
    });
  } catch (error) {
    console.error('Get today card group error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch today\'s card group' 
    });
  }
};

// Create today's card group manually
export const createTodayCardGroup = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const userId = req.user?.id;

    // Check if card group already exists for today
    const existing = await db`
      SELECT id FROM card_groups 
      WHERE group_date = ${today}
    `;

    if (existing.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'A card group for today already exists. Only one card group per day is allowed.' 
      });
    }

    const newCardGroup = await db`
      INSERT INTO card_groups (group_date, created_by)
      VALUES (${today}, ${userId || null})
      RETURNING *
    `;

    // Fetch complete info
    const cardGroupWithDetails = await db`
      SELECT cg.*, u.name as creator_name, 0 as card_count
      FROM card_groups cg
      LEFT JOIN login u ON cg.created_by = u.id
      WHERE cg.id = ${newCardGroup[0].id}
    `;

    res.json({ 
      success: true, 
      cardGroup: {
        ...cardGroupWithDetails[0],
        cards: []
      },
      message: 'Card group created successfully' 
    });
  } catch (error) {
    console.error('Create card group error:', error);
    
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'A card group for today already exists.'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create card group' 
    });
  }
};

// Get all card groups with pagination
export const getAllCardGroups = async (req, res) => {
  try {
    const { limit = 12, offset = 0 } = req.query;
    const parsedLimit = parseInt(limit);
    const parsedOffset = parseInt(offset);

    // Get total count
    const [countResult] = await db`
      SELECT COUNT(*) as total FROM card_groups
    `;
    const total = parseInt(countResult.total);

    // Get paginated card groups
    const cardGroups = await db`
      SELECT cg.*, u.name as creator_name,
             (SELECT COUNT(*) FROM cards WHERE card_group_id = cg.id) as card_count
      FROM card_groups cg
      LEFT JOIN login u ON cg.created_by = u.id
      ORDER BY cg.group_date DESC 
      LIMIT ${parsedLimit} 
      OFFSET ${parsedOffset}
    `;

    res.json({ 
      success: true, 
      cardGroups,
      pagination: {
        total,
        limit: parsedLimit,
        offset: parsedOffset,
        hasMore: parsedOffset + parsedLimit < total
      }
    });
  } catch (error) {
    console.error('Get all card groups error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch card groups' 
    });
  }
};

// Auto-generate card group (used by cron)
export const autoGenerateCardGroup = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Check if card group already exists for today
    const existing = await db`
      SELECT id FROM card_groups 
      WHERE group_date = ${today}
    `;

    if (existing.length > 0) {
      console.log(`✓ Card group for ${today} already exists (ID: ${existing[0].id})`);
      return;
    }

    const newCardGroup = await db`
      INSERT INTO card_groups (group_date, created_by)
      VALUES (${today}, NULL)
      RETURNING *
    `;

    console.log(`✅ Auto-generated card group for ${today} (ID: ${newCardGroup[0].id})`);
  } catch (error) {
    if (error.code === '23505') {
      console.log(`✓ Card group for today already exists (duplicate prevented)`);
    } else {
      console.error('❌ Auto-generate card group error:', error);
    }
  }
};

// Get cards for a specific group with pagination
export const getGroupCards = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    const parsedLimit = parseInt(limit);
    const parsedOffset = parseInt(offset);

    // Get total count
    const [countResult] = await db`
      SELECT COUNT(*) as total FROM cards WHERE card_group_id = ${groupId}
    `;
    const total = parseInt(countResult.total);

    // ✅ FIXED: Removed ::text casting
    const cards = await db`
      SELECT c.*, u.name as creator_name
      FROM cards c
      LEFT JOIN login u ON c.created_by = u.id
      WHERE c.card_group_id = ${groupId}
      ORDER BY c.created_at ASC
      LIMIT ${parsedLimit}
      OFFSET ${parsedOffset}
    `;

    res.json({ 
      success: true, 
      cards,
      pagination: {
        total,
        limit: parsedLimit,
        offset: parsedOffset,
        hasMore: parsedOffset + parsedLimit < total
      }
    });
  } catch (error) {
    console.error('Get group cards error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch cards' 
    });
  }
};

// Get single group details
export const getGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await db`
      SELECT cg.*, u.name as creator_name,
             (SELECT COUNT(*) FROM cards WHERE card_group_id = cg.id) as card_count
      FROM card_groups cg
      LEFT JOIN login u ON cg.created_by = u.id
      WHERE cg.id = ${groupId}
      LIMIT 1
    `;

    if (group.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Card group not found'
      });
    }

    res.json({
      success: true,
      group: group[0]
    });
  } catch (error) {
    console.error('Get group details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch group details'
    });
  }
};

// ✅ FIXED: Create card in group
export const createCardInGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { card_title } = req.body;
    const userId = req.user?.id;

    console.log('📝 Create card:', { groupId, card_title, userId, userType: typeof userId });

    if (!card_title?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Card title is required'
      });
    }

    // Verify group exists
    const group = await db`
      SELECT id FROM card_groups WHERE id = ${groupId}
    `;

    if (group.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Card group not found'
      });
    }

    // ✅ Insert card with integer userId
    const newCard = await db`
      INSERT INTO cards (card_group_id, card_title, created_by)
      VALUES (${groupId}, ${card_title.trim()}, ${userId || null})
      RETURNING *
    `;

    console.log('✅ Card created:', newCard[0]);

    // ✅ Fetch complete card info - FIXED JOIN
    const cardWithDetails = await db`
      SELECT c.*, u.name as creator_name
      FROM cards c
      LEFT JOIN login u ON c.created_by = u.id
      WHERE c.id = ${newCard[0].id}
    `;

    res.json({
      success: true,
      card: cardWithDetails[0],
      message: 'Card created successfully'
    });
  } catch (error) {
    console.error('❌ Create card error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create card'
    });
  }
};

// ✅ FIXED: Update card title
export const updateCard = async (req, res) => {
  try {
    const { cardId } = req.params;
    const { card_title } = req.body;

    if (!card_title?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Card title is required'
      });
    }

    const updated = await db`
      UPDATE cards
      SET card_title = ${card_title.trim()}
      WHERE id = ${cardId}
      RETURNING *
    `;

    if (updated.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Card not found'
      });
    }

    // ✅ Fetch complete card info - FIXED JOIN
    const cardWithDetails = await db`
      SELECT c.*, u.name as creator_name
      FROM cards c
      LEFT JOIN login u ON c.created_by = u.id
      WHERE c.id = ${updated[0].id}
    `;

    res.json({
      success: true,
      card: cardWithDetails[0],
      message: 'Card updated successfully'
    });
  } catch (error) {
    console.error('Update card error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update card'
    });
  }
};

// Delete card
export const deleteCard = async (req, res) => {
  try {
    const { cardId } = req.params;

    const deleted = await db`
      DELETE FROM cards 
      WHERE id = ${cardId}
      RETURNING id
    `;

    if (deleted.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Card not found'
      });
    }

    res.json({
      success: true,
      message: 'Card deleted successfully'
    });
  } catch (error) {
    console.error('Delete card error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete card'
    });
  }
};
