import db from '../../utils/db.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload directory exists
const uploadDir = 'uploads/card-images/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'card-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 10 * 1024 * 1024,
    files: 20
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

export const uploadCardImages = upload.any();

// Update card title
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
      SET card_title = ${card_title}
      WHERE id = ${cardId}
      RETURNING *
    `;

    if (updated.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Card not found'
      });
    }

    const cardWithDetails = await db`
      SELECT c.*, u.name as creator_name
      FROM cards c
      LEFT JOIN login u ON c.created_by = u.id
      WHERE c.id = ${cardId}
    `;

    res.json({
      success: true,
      card: cardWithDetails[0],
      message: 'Card updated successfully'
    });
  } catch (error) {
    console.error('❌ Update card error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update card'
    });
  }
};

// Get single card with parsed card_content and latest generation
export const getCard = async (req, res) => {
  try {
    const { cardId } = req.params;

    console.log('📄 Fetching card:', cardId);

    const card = await db`
      SELECT c.*, u.name as creator_name
      FROM cards c
      LEFT JOIN login u ON c.created_by = u.id
      WHERE c.id = ${cardId}
      LIMIT 1
    `;

    if (card.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Card not found'
      });
    }

    // ✅ Parse card_content if it's a string
    let cardContent = card[0].card_content;
    if (typeof cardContent === 'string') {
      try {
        cardContent = JSON.parse(cardContent);
        console.log('✅ Parsed card_content from string');
      } catch (e) {
        console.error('Failed to parse card_content:', e);
        cardContent = {};
      }
    }

    console.log('📋 card_content keys:', Object.keys(cardContent || {}).length);

    // ✅ Get current generation (latest in timeline)
    const currentGeneration = await db`
      SELECT * FROM card_generations
      WHERE card_id = ${cardId} AND is_current = true
      LIMIT 1
    `;

    console.log('📊 Current generation exists:', currentGeneration.length > 0);

    const currentGen = currentGeneration[0] ? {
      ...currentGeneration[0],
      field_values: typeof currentGeneration[0].field_values === 'string' 
        ? JSON.parse(currentGeneration[0].field_values) 
        : currentGeneration[0].field_values,
      generated_output: typeof currentGeneration[0].generated_output === 'string' 
        ? JSON.parse(currentGeneration[0].generated_output) 
        : currentGeneration[0].generated_output,
      uploaded_images: typeof currentGeneration[0].uploaded_images === 'string' 
        ? JSON.parse(currentGeneration[0].uploaded_images) 
        : currentGeneration[0].uploaded_images
    } : null;

    res.json({
      success: true,
      card: {
        ...card[0],
        card_content: cardContent || {}
      },
      current_generation: currentGen
    });
  } catch (error) {
    console.error('❌ Get card error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch card'
    });
  }
};

// Get field metadata
export const getFieldMetadata = async (req, res) => {
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
    console.error('❌ Get field metadata error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch field metadata'
    });
  }
};

// ✅ Generate content - saves field_values to cards.card_content on FIRST generation ONLY for creator's cards
export const generateContent = async (req, res) => {
  console.log('\n========== 🚀 GENERATE CONTENT REQUEST ==========');
  try {
    const { cardId } = req.params;
    let { style_selected, field_values, generated_output, existing_images } = req.body;
    const userId = req.user?.id;

    console.log('📥 Request params:');
    console.log('  - cardId:', cardId);
    console.log('  - userId:', userId);
    console.log('  - files received:', req.files?.length || 0);

    // ✅ Get card details to check creator
    const cardCheck = await db`
      SELECT id, created_by, card_title
      FROM cards
      WHERE id = ${cardId}
      LIMIT 1
    `;

    if (cardCheck.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Card not found'
      });
    }

    const isCreator = cardCheck[0].created_by === userId;
    console.log('📊 Card creator check:');
    console.log('  - Card creator:', cardCheck[0].created_by);
    console.log('  - Current user:', userId);
    console.log('  - Is creator?', isCreator);

    // Parse JSON strings
    if (typeof field_values === 'string') {
      field_values = JSON.parse(field_values);
    }

    if (typeof generated_output === 'string') {
      generated_output = JSON.parse(generated_output);
    }

    // Parse existing images
    let existingImagesObj = {};
    if (existing_images) {
      try {
        existingImagesObj = typeof existing_images === 'string' 
          ? JSON.parse(existing_images) 
          : existing_images;
        console.log('  ✅ Received pre-filtered existing_images');
      } catch (e) {
        console.error('  ❌ Failed to parse existing_images:', e.message);
        existingImagesObj = {};
      }
    }

    // Process uploaded files
    const newFilesByField = {};
    
    if (req.files && req.files.length > 0) {
      console.log('\n📸 Processing uploaded files...');
      req.files.forEach(file => {
        const fieldName = file.fieldname;
        const fileUrl = `/uploads/card-images/${file.filename}`;
        
        if (!newFilesByField[fieldName]) {
          newFilesByField[fieldName] = [];
        }
        newFilesByField[fieldName].push(fileUrl);
      });
    }

    // SIMPLE MERGE: existing + new
    const finalImages = { ...existingImagesObj };
    
    if (Object.keys(newFilesByField).length > 0) {
      console.log('\n➕ Appending new images...');
      Object.keys(newFilesByField).forEach(fieldName => {
        const existing = finalImages[fieldName] || [];
        finalImages[fieldName] = [...existing, ...newFilesByField[fieldName]];
        console.log(`  - ${fieldName}: ${existing.length} existing + ${newFilesByField[fieldName].length} new = ${finalImages[fieldName].length} total`);
      });
    }

    console.log('\n💾 Final images:', JSON.stringify(finalImages, null, 2));

    // Get next generation number
    const lastGen = await db`
      SELECT MAX(generation_number) as max_num
      FROM card_generations
      WHERE card_id = ${cardId}
    `;
    
    const nextGenNumber = (lastGen[0]?.max_num || 0) + 1;
    const isFirstGeneration = nextGenNumber === 1;

    console.log(`\n📊 Generation number: ${nextGenNumber}`);
    
    // ✅ Only populate card_content if FIRST generation AND user is the creator
    const shouldPopulateCardContent = isFirstGeneration && isCreator;
    
    if (shouldPopulateCardContent) {
      console.log('✅ FIRST generation + User is CREATOR → Will populate cards.card_content');
    } else if (isFirstGeneration && !isCreator) {
      console.log('⚠️  FIRST generation but user is NOT creator → Will NOT populate cards.card_content');
    } else {
      console.log('⏭️  Not first generation → Skipping cards.card_content update');
    }

    // Set all previous generations to not current
    await db`
      UPDATE card_generations
      SET is_current = false
      WHERE card_id = ${cardId}
    `;

    // ✅ Save new generation
    const newGen = await db`
      INSERT INTO card_generations (
        card_id, 
        style_selected, 
        field_values,
        generated_output,
        uploaded_images,
        generation_number,
        is_current
      )
      VALUES (
        ${cardId},
        ${style_selected},
        ${JSON.stringify(field_values)},
        ${JSON.stringify(generated_output || {})},
        ${JSON.stringify(finalImages)},
        ${nextGenNumber},
        true
      )
      RETURNING *
    `;

    // ✅ ONLY populate cards.card_content if FIRST generation AND user is the creator
    if (shouldPopulateCardContent) {
      console.log('\n📝 Populating cards.card_content with field_values (creator only)...');
      console.log('Field values to save:', field_values);
      
      await db`
        UPDATE cards
        SET card_content = ${JSON.stringify(field_values)}::jsonb,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${cardId}
      `;
      
      console.log('✅ cards.card_content populated successfully');
    }

    console.log('\n✅✅✅ Generation saved successfully!');
    console.log('  Generation ID:', newGen[0].id);
    console.log('  Generation Number:', newGen[0].generation_number);
    console.log('  Is First:', isFirstGeneration);
    console.log('  Is Creator:', isCreator);
    console.log('  Card content populated:', shouldPopulateCardContent);
    console.log('========================================\n');

    const generationToSend = {
      ...newGen[0],
      field_values: typeof newGen[0].field_values === 'string' 
        ? JSON.parse(newGen[0].field_values) 
        : newGen[0].field_values,
      generated_output: typeof newGen[0].generated_output === 'string' 
        ? JSON.parse(newGen[0].generated_output) 
        : newGen[0].generated_output,
      uploaded_images: typeof newGen[0].uploaded_images === 'string' 
        ? JSON.parse(newGen[0].uploaded_images) 
        : newGen[0].uploaded_images
    };

    res.json({
      success: true,
      generation: generationToSend,
      message: 'Content saved successfully',
      isFirstGeneration,
      cardContentPopulated: shouldPopulateCardContent
    });
  } catch (error) {
    console.error('\n❌❌❌ GENERATE CONTENT ERROR ❌❌❌');
    console.error('Error:', error);
    console.error('========================================\n');
    
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        const filePath = path.join(uploadDir, file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save content'
    });
  }
};

// Update/Override existing generation (TEXT ONLY - preserves images)
export const updateGeneration = async (req, res) => {
  console.log('\n========== 🔄 UPDATE GENERATION REQUEST ==========');
  try {
    const { cardId, generationId } = req.params;
    let { style_selected, generated_output, field_values } = req.body;

    // Parse JSON if string
    if (typeof generated_output === 'string') {
      generated_output = JSON.parse(generated_output);
    }

    if (typeof field_values === 'string') {
      field_values = JSON.parse(field_values);
    }

    if (!style_selected || !generated_output || !field_values) {
      return res.status(400).json({
        success: false,
        error: 'style_selected, generated_output, and field_values are required'
      });
    }

    const updated = await db`
      UPDATE card_generations
      SET 
        style_selected = ${style_selected},
        generated_output = ${JSON.stringify(generated_output)},
        field_values = ${JSON.stringify(field_values)},
        updated_at = NOW()
      WHERE id = ${generationId} AND card_id = ${cardId}
      RETURNING *
    `;

    if (updated.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Generation not found'
      });
    }

    console.log('\n✅✅✅ Generation updated successfully!');
    console.log('========================================\n');

    const generationToSend = {
      ...updated[0],
      field_values: typeof updated[0].field_values === 'string' 
        ? JSON.parse(updated[0].field_values) 
        : updated[0].field_values,
      generated_output: typeof updated[0].generated_output === 'string' 
        ? JSON.parse(updated[0].generated_output) 
        : updated[0].generated_output,
      uploaded_images: typeof updated[0].uploaded_images === 'string' 
        ? JSON.parse(updated[0].uploaded_images) 
        : updated[0].uploaded_images
    };

    res.json({
      success: true,
      generation: generationToSend,
      message: 'Generation updated successfully'
    });
  } catch (error) {
    console.error('\n❌❌❌ UPDATE GENERATION ERROR ❌❌❌');
    console.error('Error:', error);
    console.error('========================================\n');
    
    res.status(500).json({
      success: false,
      error: 'Failed to update generation'
    });
  }
};

// ✅ Update generation WITH new images
export const updateGenerationWithImages = async (req, res) => {
  console.log('\n========== 🔄 UPDATE GENERATION WITH IMAGES ==========');
  try {
    const { cardId, generationId } = req.params;
    let { style_selected, generated_output, field_values, existing_images } = req.body;

    // Parse JSON
    if (typeof generated_output === 'string') {
      generated_output = JSON.parse(generated_output);
    }
    if (typeof field_values === 'string') {
      field_values = JSON.parse(field_values);
    }

    // Parse existing images
    let existingImagesObj = {};
    if (existing_images) {
      existingImagesObj = typeof existing_images === 'string'
        ? JSON.parse(existing_images)
        : existing_images;
      console.log('  ✅ Received pre-filtered existing_images');
    }

    // Process new files
    const newFilesByField = {};
    if (req.files && req.files.length > 0) {
      console.log('\n📸 Processing new files...');
      req.files.forEach(file => {
        const fieldName = file.fieldname;
        const fileUrl = `/uploads/card-images/${file.filename}`;
        if (!newFilesByField[fieldName]) {
          newFilesByField[fieldName] = [];
        }
        newFilesByField[fieldName].push(fileUrl);
      });
    }

    // SIMPLE MERGE: existing + new
    const finalImages = { ...existingImagesObj };
    if (Object.keys(newFilesByField).length > 0) {
      console.log('\n➕ Appending new images...');
      Object.keys(newFilesByField).forEach(fieldName => {
        const existing = finalImages[fieldName] || [];
        finalImages[fieldName] = [...existing, ...newFilesByField[fieldName]];
        console.log(`  - ${fieldName}: ${existing.length} existing + ${newFilesByField[fieldName].length} new = ${finalImages[fieldName].length} total`);
      });
    }

    console.log('\n💾 Final images:', JSON.stringify(finalImages, null, 2));

    const updated = await db`
      UPDATE card_generations
      SET 
        style_selected = ${style_selected},
        generated_output = ${JSON.stringify(generated_output)},
        field_values = ${JSON.stringify(field_values)},
        uploaded_images = ${JSON.stringify(finalImages)},
        updated_at = NOW()
      WHERE id = ${generationId} AND card_id = ${cardId}
      RETURNING *
    `;

    if (updated.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Generation not found'
      });
    }

    console.log('\n✅✅✅ Generation updated!');
    console.log('========================================\n');

    const generationToSend = {
      ...updated[0],
      field_values: typeof updated[0].field_values === 'string' 
        ? JSON.parse(updated[0].field_values) 
        : updated[0].field_values,
      generated_output: typeof updated[0].generated_output === 'string' 
        ? JSON.parse(updated[0].generated_output) 
        : updated[0].generated_output,
      uploaded_images: typeof updated[0].uploaded_images === 'string' 
        ? JSON.parse(updated[0].uploaded_images) 
        : updated[0].uploaded_images
    };

    res.json({
      success: true,
      generation: generationToSend,
      message: 'Generation updated successfully'
    });
  } catch (error) {
    console.error('\n❌ UPDATE WITH IMAGES ERROR:', error);
    console.error('========================================\n');
    
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        const filePath = path.join(uploadDir, file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update generation'
    });
  }
};

// Regenerate with different style
export const regenerateContent = async (req, res) => {
  console.log('\n========== 🔄 REGENERATE CONTENT REQUEST ==========');
  try {
    const { cardId } = req.params;
    let { style_selected, generated_output } = req.body;

    if (typeof generated_output === 'string') {
      generated_output = JSON.parse(generated_output);
    }

    if (!style_selected || !generated_output) {
      return res.status(400).json({
        success: false,
        error: 'style_selected and generated_output are required'
      });
    }

    // Get current generation
    const current = await db`
      SELECT * FROM card_generations
      WHERE card_id = ${cardId} AND is_current = true
      LIMIT 1
    `;

    if (current.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No current generation found'
      });
    }

    // Get next generation number
    const lastGen = await db`
      SELECT MAX(generation_number) as max_num
      FROM card_generations
      WHERE card_id = ${cardId}
    `;
    
    const nextGenNumber = (lastGen[0]?.max_num || 0) + 1;

    // Set all previous generations to not current
    await db`
      UPDATE card_generations
      SET is_current = false
      WHERE card_id = ${cardId}
    `;

    // Create new generation
    const newGen = await db`
      INSERT INTO card_generations (
        card_id, 
        style_selected, 
        field_values,
        generated_output,
        uploaded_images,
        generation_number,
        is_current
      )
      VALUES (
        ${cardId},
        ${style_selected},
        ${current[0].field_values},
        ${JSON.stringify(generated_output)},
        ${current[0].uploaded_images || '{}'},
        ${nextGenNumber},
        true
      )
      RETURNING *
    `;

    console.log('\n✅✅✅ Regeneration saved!');
    console.log('========================================\n');

    const generationToSend = {
      ...newGen[0],
      field_values: typeof newGen[0].field_values === 'string' 
        ? JSON.parse(newGen[0].field_values) 
        : newGen[0].field_values,
      generated_output: typeof newGen[0].generated_output === 'string' 
        ? JSON.parse(newGen[0].generated_output) 
        : newGen[0].generated_output,
      uploaded_images: typeof newGen[0].uploaded_images === 'string' 
        ? JSON.parse(newGen[0].uploaded_images) 
        : newGen[0].uploaded_images
    };

    res.json({
      success: true,
      generation: generationToSend,
      message: 'Content regenerated successfully'
    });
  } catch (error) {
    console.error('\n❌❌❌ REGENERATE CONTENT ERROR ❌❌❌');
    console.error('Error:', error);
    console.error('========================================\n');
    
    res.status(500).json({
      success: false,
      error: 'Failed to save regenerated content'
    });
  }
};

// Get current generation
export const getCurrentGeneration = async (req, res) => {
  try {
    const { cardId } = req.params;

    const generation = await db`
      SELECT * FROM card_generations
      WHERE card_id = ${cardId} AND is_current = true
      LIMIT 1
    `;
    
    const generationToSend = generation[0] ? {
      ...generation[0],
      field_values: typeof generation[0].field_values === 'string' 
        ? JSON.parse(generation[0].field_values) 
        : generation[0].field_values,
      generated_output: typeof generation[0].generated_output === 'string' 
        ? JSON.parse(generation[0].generated_output) 
        : generation[0].generated_output,
      uploaded_images: typeof generation[0].uploaded_images === 'string' 
        ? JSON.parse(generation[0].uploaded_images) 
        : generation[0].uploaded_images
    } : null;
    
    res.json({
      success: true,
      generation: generationToSend
    });
  } catch (error) {
    console.error('❌ Get current generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch current generation'
    });
  }
};

// Get all generations for a card
export const getAllGenerations = async (req, res) => {
  try {
    const { cardId } = req.params;

    const generations = await db`
      SELECT * FROM card_generations
      WHERE card_id = ${cardId}
      ORDER BY generation_number DESC
    `;
    
    const generationsToSend = generations.map(gen => ({
      ...gen,
      field_values: typeof gen.field_values === 'string' 
        ? JSON.parse(gen.field_values) 
        : gen.field_values,
      generated_output: typeof gen.generated_output === 'string' 
        ? JSON.parse(gen.generated_output) 
        : gen.generated_output,
      uploaded_images: typeof gen.uploaded_images === 'string' 
        ? JSON.parse(gen.uploaded_images) 
        : gen.uploaded_images
    }));
    
    res.json({
      success: true,
      generations: generationsToSend
    });
  } catch (error) {
    console.error('❌ Get all generations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch generations'
    });
  }
};
