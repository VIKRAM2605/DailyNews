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

    // Get paginated card groups with is_today calculated in database
    const cardGroups = await db`
      SELECT cg.*, u.name as creator_name,
             (SELECT COUNT(*) FROM cards WHERE card_group_id = cg.id) as card_count,
             cg.group_date = CURRENT_DATE as is_today,
             cg.group_date < CURRENT_DATE as is_past
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

    const group = await db`
      SELECT cg.*, u.name as creator_name,
             (SELECT COUNT(*) FROM cards WHERE card_group_id = cg.id) as card_count,
             cg.group_date = CURRENT_DATE as is_today,
             cg.group_date < CURRENT_DATE as is_past
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

    if (!card_title?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Card title is required'
      });
    }

    // Verify group exists and is TODAY
    const group = await db`
      SELECT id, group_date,
             group_date = CURRENT_DATE as is_today
      FROM card_groups 
      WHERE id = ${groupId}
    `;

    if (group.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Card group not found'
      });
    }

    if (!group[0].is_today) {
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
    console.error('Create card error:', error);
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

    console.log('📄 Fetching card details for:', cardId);

    // Get card details
    const card = await db`
      SELECT c.*, u.name as creator_name,
             cg.group_date,
             cg.group_date = CURRENT_DATE as is_today,
             cg.group_date < CURRENT_DATE as is_past
      FROM cards c
      LEFT JOIN login u ON c.created_by = u.id
      LEFT JOIN card_groups cg ON c.card_group_id = cg.id
      WHERE c.id = ${cardId}
      LIMIT 1
    `;

    if (card.length === 0) {
      console.log('❌ Card not found');
      return res.status(404).json({
        success: false,
        error: 'Card not found'
      });
    }

    console.log('✅ Card found, fetching field metadata...');

    // Fetch ALL field metadata
    const fieldMetadata = await db`
      SELECT id, field_name, field_type, label, place_holder, is_required, max_files
      FROM field_metadata
      ORDER BY id ASC
    `;

    console.log('📋 Field metadata count:', fieldMetadata.length);

    // Parse card_content if it's a string
    let cardContent = card[0].card_content;
    if (typeof cardContent === 'string') {
      try {
        cardContent = JSON.parse(cardContent);
        console.log('✅ Parsed card_content from string');
      } catch (e) {
        console.error('❌ Failed to parse card_content:', e);
        cardContent = {};
      }
    }

    const cardData = {
      ...card[0],
      card_content: cardContent || {},
      field_metadata: fieldMetadata
    };

    console.log('📦 Sending card with', Object.keys(cardContent || {}).length, 'content fields');

    res.json({
      success: true,
      card: cardData
    });
  } catch (error) {
    console.error('Get card details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch card details'
    });
  }
};

// Update card content (only for TODAY) + permission check
// Update card content (only for TODAY) + permission check + collaboration logic
export const updateFacultyCardContent = async (req, res) => {
  try {
    const { cardId } = req.params;
    const { content } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    console.log('📝 Update card content');
    console.log('Card ID:', cardId);
    console.log('User ID:', userId, 'Role:', userRole);

    if (typeof content !== 'object' || content === null) {
      return res.status(400).json({
        success: false,
        error: 'Content must be an object with field data'
      });
    }

    // 1️⃣ Check if card exists, get group_date + owner + last writer
    const cardCheck = await db`
      SELECT 
        c.id,
        c.created_by,
        c.updated_by,
        c.last_updated_by_role,
        cg.group_date,
        cg.group_date = CURRENT_DATE as is_today
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

    const cardRow = cardCheck[0];

    // 2️⃣ Only allow editing today's cards
    if (!cardRow.is_today) {
      return res.status(403).json({
        success: false,
        error: 'You can only edit content for today\'s cards'
      });
    }

    // 3️⃣ Permission check
    const isAdmin = userRole === 'admin';
    if (!isAdmin) {
      const isOwner = cardRow.created_by === userId;

      if (!isOwner) {
        const permission = await db`
          SELECT can_edit 
          FROM card_permissions
          WHERE card_id = ${cardId} AND user_id = ${userId}
          LIMIT 1
        `;

        const hasAccess = permission.length > 0 && permission[0].can_edit === true;

        if (!hasAccess) {
          console.log('❌ Faculty has no permission for card', { cardId, userId });
          return res.status(403).json({
            success: false,
            error: 'You do not have permission to edit this card. Ask admin to share it with you.'
          });
        }
      }
    }

    // ✅ 4️⃣ COLLABORATION LOGIC
    const lastWriterRole = cardRow.last_updated_by_role;
    const isFacultyFaculty = userRole === 'faculty' && lastWriterRole === 'faculty';
    const isOverride = (userRole === 'admin' && lastWriterRole === 'faculty') || 
                       (userRole === 'faculty' && lastWriterRole === 'admin');

    console.log('🤝 Collaboration check:', {
      currentUserRole: userRole,
      lastWriterRole,
      isFacultyFaculty,
      isOverride
    });

    // 5️⃣ Update content + set updated_by (trigger will auto-update last_updated_by_role)
    const updated = await db`
      UPDATE cards
      SET 
        card_content = ${JSON.stringify(content)}::jsonb,
        updated_by = ${userId},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${cardId}
      RETURNING *
    `;

    // 6️⃣ Fetch complete card info
    const cardWithDetails = await db`
      SELECT c.*, u.name as creator_name
      FROM cards c
      LEFT JOIN login u ON c.created_by = u.id
      WHERE c.id = ${updated[0].id}
    `;

    // Parse card_content before sending
    let cardContent = cardWithDetails[0].card_content;
    if (typeof cardContent === 'string') {
      try {
        cardContent = JSON.parse(cardContent);
      } catch (e) {
        cardContent = {};
      }
    }

    console.log('✅ Content updated with collaboration type:', 
      isFacultyFaculty ? 'FACULTY_COLLABORATION' : 'OVERRIDE'
    );

    res.json({
      success: true,
      card: {
        ...cardWithDetails[0],
        card_content: cardContent
      },
      collaboration: {
        type: isFacultyFaculty ? 'faculty_collaboration' : 'override',
        message: isFacultyFaculty 
          ? 'Faculty collaboration - last save wins' 
          : `${userRole} override - content replaced`
      },
      message: 'Card content updated successfully'
    });
  } catch (error) {
    console.error('Update card content error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update card content'
    });
  }
};

