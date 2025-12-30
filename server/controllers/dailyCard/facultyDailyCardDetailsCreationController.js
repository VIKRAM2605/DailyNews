import db from '../../utils/db.js';

// Get all card groups for faculty (paginated)
export const getFacultyCardGroups = async (req, res) => {
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

    // Add is_today flag to each group
    const today = new Date().toISOString().split('T')[0];
    const enrichedGroups = cardGroups.map(group => ({
      ...group,
      is_today: group.group_date === today,
      is_past: group.group_date < today
    }));

    res.json({ 
      success: true, 
      cardGroups: enrichedGroups,
      pagination: {
        total,
        limit: parsedLimit,
        offset: parsedOffset,
        hasMore: parsedOffset + parsedLimit < total
      }
    });
  } catch (error) {
    console.error('Get faculty card groups error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch card groups' 
    });
  }
};

// Get single group details for faculty
export const getFacultyGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;
    const today = new Date().toISOString().split('T')[0];

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

    const groupData = {
      ...group[0],
      is_today: group[0].group_date === today,
      is_past: group[0].group_date < today
    };

    res.json({
      success: true,
      group: groupData
    });
  } catch (error) {
    console.error('Get faculty group details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch group details'
    });
  }
};

// Get cards for faculty in a group
export const getFacultyGroupCards = async (req, res) => {
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

    // Get paginated cards
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
    console.error('Get faculty group cards error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch cards' 
    });
  }
};

// Create card for TODAY only (Faculty)
export const createFacultyCard = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { card_title } = req.body;
    const userId = req.user?.id;

    console.log('📝 Faculty create card:', { groupId, card_title, userId });

    if (!card_title?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Card title is required'
      });
    }

    // Verify group exists and is TODAY
    const today = new Date().toISOString().split('T')[0];
    const group = await db`
      SELECT id, group_date FROM card_groups WHERE id = ${groupId}
    `;

    if (group.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Card group not found'
      });
    }

    if (group[0].group_date !== today) {
      return res.status(403).json({
        success: false,
        error: 'You can only create cards for today\'s group'
      });
    }

    // Insert card
    const newCard = await db`
      INSERT INTO cards (card_group_id, card_title, created_by)
      VALUES (${groupId}, ${card_title.trim()}, ${userId || null})
      RETURNING *
    `;

    console.log('✅ Faculty card created:', newCard[0]);

    // Fetch complete card info
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
    console.error('❌ Faculty create card error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create card'
    });
  }
};

// Get single card details for faculty
export const getFacultyCardDetails = async (req, res) => {
  try {
    const { cardId } = req.params;

    const card = await db`
      SELECT c.*, u.name as creator_name,
             cg.group_date
      FROM cards c
      LEFT JOIN login u ON c.created_by = u.id
      LEFT JOIN card_groups cg ON c.card_group_id = cg.id
      WHERE c.id = ${cardId}
      LIMIT 1
    `;

    if (card.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Card not found'
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const cardData = {
      ...card[0],
      is_today: card[0].group_date === today,
      is_past: card[0].group_date < today
    };

    res.json({
      success: true,
      card: cardData
    });
  } catch (error) {
    console.error('Get faculty card details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch card details'
    });
  }
};

// Update card content (only for TODAY)
export const updateFacultyCardContent = async (req, res) => {
  try {
    const { cardId } = req.params;
    const { content } = req.body;

    console.log('📝 Faculty update card content:', { cardId, contentLength: content?.length });

    // Get card with group date
    const cardCheck = await db`
      SELECT c.id, cg.group_date
      FROM cards c
      LEFT JOIN card_groups cg ON c.card_group_id = cg.id
      WHERE c.id = ${cardId}
    `;

    if (cardCheck.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Card not found'
      });
    }

    const today = new Date().toISOString().split('T')[0];
    if (cardCheck[0].group_date !== today) {
      return res.status(403).json({
        success: false,
        error: 'You can only edit content for today\'s cards'
      });
    }

    // Update content (add your content field to cards table if needed)
    const updated = await db`
      UPDATE cards
      SET card_content = ${content || ''}
      WHERE id = ${cardId}
      RETURNING *
    `;

    // Fetch complete card info
    const cardWithDetails = await db`
      SELECT c.*, u.name as creator_name
      FROM cards c
      LEFT JOIN login u ON c.created_by = u.id
      WHERE c.id = ${updated[0].id}
    `;

    res.json({
      success: true,
      card: cardWithDetails[0],
      message: 'Card content updated successfully'
    });
  } catch (error) {
    console.error('Update faculty card content error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update card content'
    });
  }
};
