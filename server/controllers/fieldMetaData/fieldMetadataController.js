import db from '../../utils/db.js';

// Get all fields
export const getAllFields = async (req, res) => {
  try {
    const fields = await db`
      SELECT * FROM field_metadata
      ORDER BY id ASC
    `;

    res.json({
      success: true,
      fields
    });
  } catch (error) {
    console.error('❌ Get all fields error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fields'
    });
  }
};

// Get single field
export const getField = async (req, res) => {
  try {
    const { fieldId } = req.params;

    const field = await db`
      SELECT * FROM field_metadata
      WHERE id = ${fieldId}
      LIMIT 1
    `;

    if (field.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Field not found'
      });
    }

    res.json({
      success: true,
      field: field[0]
    });
  } catch (error) {
    console.error('❌ Get field error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch field'
    });
  }
};

// Create new field
export const createField = async (req, res) => {
  try {
    const { field_name, field_type, label, is_required, max_files, place_holder } = req.body;

    // Validation
    if (!field_name?.trim() || !field_type?.trim() || !label?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'field_name, field_type, and label are required'
      });
    }

    // Check if field_name already exists
    const existing = await db`
      SELECT id FROM field_metadata
      WHERE field_name = ${field_name}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Field with name "${field_name}" already exists`
      });
    }

    // Create field
    const newField = await db`
      INSERT INTO field_metadata (
        field_name,
        field_type,
        label,
        is_required,
        max_files,
        place_holder
      )
      VALUES (
        ${field_name},
        ${field_type},
        ${label},
        ${is_required || false},
        ${max_files || null},
        ${place_holder || null}
      )
      RETURNING *
    `;

    res.json({
      success: true,
      field: newField[0],
      message: 'Field created successfully'
    });
  } catch (error) {
    console.error('❌ Create field error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create field'
    });
  }
};

// Update field
export const updateField = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const { field_name, field_type, label, is_required, max_files, place_holder } = req.body;

    // Validation
    if (!field_name?.trim() || !field_type?.trim() || !label?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'field_name, field_type, and label are required'
      });
    }

    // Check if field_name already exists (excluding current field)
    const existing = await db`
      SELECT id FROM field_metadata
      WHERE field_name = ${field_name} AND id != ${fieldId}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Field with name "${field_name}" already exists`
      });
    }

    const updated = await db`
      UPDATE field_metadata
      SET 
        field_name = ${field_name},
        field_type = ${field_type},
        label = ${label},
        is_required = ${is_required || false},
        max_files = ${max_files || null},
        place_holder = ${place_holder || null}
      WHERE id = ${fieldId}
      RETURNING *
    `;

    if (updated.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Field not found'
      });
    }

    res.json({
      success: true,
      field: updated[0],
      message: 'Field updated successfully'
    });
  } catch (error) {
    console.error('❌ Update field error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update field'
    });
  }
};

// Delete field
export const deleteField = async (req, res) => {
  try {
    const { fieldId } = req.params;

    const deleted = await db`
      DELETE FROM field_metadata
      WHERE id = ${fieldId}
      RETURNING *
    `;

    if (deleted.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Field not found'
      });
    }

    res.json({
      success: true,
      field: deleted[0],
      message: 'Field deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete field error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete field'
    });
  }
};
