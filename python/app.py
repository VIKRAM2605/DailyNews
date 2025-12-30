from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import google.generativeai as genai
from datetime import datetime
import re

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configure Gemini
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    print("✅ Gemini API configured successfully")
else:
    print("⚠️ WARNING: GEMINI_API_KEY not found in environment variables")

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'service': 'AI Generation Service (Python)',
        'model': 'gemini-2.0-flash-exp',
        'api_key_configured': bool(GEMINI_API_KEY)
    })

@app.route('/api/generate', methods=['POST'])
def generate_content():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        field_values = data.get('field_values')
        style_selected = data.get('style_selected', 'professional')
        
        if not field_values:
            return jsonify({
                'success': False,
                'error': 'field_values is required'
            }), 400
        
        print(f"\n🚀 Generating content with style: {style_selected}")
        print(f"📝 Field values received: {list(field_values.keys())}")
        
        # Generate content using Gemini
        result = generate_with_gemini(field_values, style_selected)
        
        print(f"✅ Generated content successfully")
        print(f"   Headline: {result.get('headline', 'N/A')[:50]}...")
        print(f"   Body length: {len(result.get('body_text', ''))} chars")
        
        return jsonify({
            'success': True,
            'generated_content': result,
            'model': 'gemini-2.0-flash-exp',
            'timestamp': result.get('generated_at')
        })
        
    except Exception as e:
        print(f"❌ Error in generate_content: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Return fallback content
        return jsonify({
            'success': True,
            'generated_content': create_fallback_content(field_values),
            'error_message': str(e)
        })

def generate_with_gemini(field_values, style_selected):
    """Generate content using Google Gemini API with DYNAMIC field handling"""
    
    if not GEMINI_API_KEY:
        print("⚠️ No API key, using fallback")
        return create_fallback_content(field_values)
    
    try:
        # Style-specific instructions
        style_instructions = {
            'professional': 'Write in a formal, professional, and authoritative tone suitable for business communications. Use clear, concise language with industry terminology.',
            'casual': 'Write in a friendly, conversational, and relaxed tone. Use everyday language that feels natural and approachable.',
            'creative': 'Write in an imaginative, unique, and artistic tone. Use vivid descriptions, metaphors, and creative storytelling techniques.',
            'technical': 'Write in a detailed, precise, and technical tone. Use industry-specific terminology and focus on specifications and features.',
            'persuasive': 'Write in a convincing, compelling, and motivational tone. Focus on benefits, emotions, and calls to action that drive engagement.'
        }
        
        style_instruction = style_instructions.get(style_selected, style_instructions['professional'])
        
        # Build field information automatically
        field_info_lines = []
        for field_name, field_value in field_values.items():
            if field_value and str(field_value).strip():
                formatted_name = field_name.replace('_', ' ').title()
                field_info_lines.append(f"**{formatted_name}:** {field_value}")
        
        field_info = "\n".join(field_info_lines) if field_info_lines else "No specific information provided"
        
        # Extract key fields with fallbacks
        title = (field_values.get('card_title') or 
                field_values.get('title') or 
                field_values.get('name') or 
                'Your Topic')
        
        description = (field_values.get('main_description') or 
                      field_values.get('description') or 
                      field_values.get('content') or 
                      '')
        
        audience = (field_values.get('target_audience') or 
                   field_values.get('audience') or 
                   'general audience')
        
        cta = (field_values.get('call_to_action') or 
              field_values.get('cta') or 
              'Learn More')
        
        # ✅ IMPROVED PROMPT - Avoid repetition and generic content
        prompt = f"""You are a professional content writer. Create cohesive, natural-flowing content about the given topic.

**Topic:** {title}
**Target Audience:** {audience}
**Writing Style:** {style_instruction}

**Key Information to Include:**
{field_info}

**Critical Requirements:**
1. Write naturally flowing paragraphs where each sentence logically connects to the next
2. NEVER repeat the same phrase, sentence, or idea twice
3. Stay focused on "{title}" and "{audience}" throughout - avoid generic business jargon
4. Use proper grammar (e.g., "making lives easier" not "making life's easy")
5. Each paragraph must build on the previous one with smooth transitions
6. Be specific to the topic - avoid phrases like "comprehensive solution," "cutting-edge strategies," "proven methodologies" unless directly relevant
7. Make every sentence meaningful and connected to the topic
8. Vary your vocabulary - don't use the same descriptive words repeatedly
9. The content should read as one cohesive piece, not disconnected statements

**Create:**
- HEADLINE: One compelling, specific headline (10-15 words) about {title} for {audience}
- BODY_TEXT: 3-4 connected, flowing paragraphs (250-350 words total) that tell a coherent story about {title}
- CALL_TO_ACTION: One clear, specific action phrase (3-7 words)

Write as if explaining this topic to a real person. Make it natural, coherent, and meaningful.

**Format your response EXACTLY as:**

HEADLINE: [your headline]

BODY_TEXT: [your flowing, connected paragraphs]

CALL_TO_ACTION: [your action phrase]
"""
        
        print(f"🤖 Calling Gemini API with {len(field_values)} dynamic fields...")
        
        # Initialize Gemini model
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        # Generate content with configuration
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=1500,
                temperature=0.8,
                top_p=0.95,
                top_k=40
            )
        )
        
        # Parse the response
        generated_text = response.text
        print(f"📄 Raw response length: {len(generated_text)} chars")
        
        # Extract structured content
        headline = extract_section(generated_text, 'HEADLINE')
        body_text = extract_section(generated_text, 'BODY_TEXT')
        call_to_action = extract_section(generated_text, 'CALL_TO_ACTION')
        
        # Validate content
        if not body_text or len(body_text) < 100:
            print(f"⚠️ Body text too short ({len(body_text)} chars), using fallback")
            return create_fallback_content(field_values)
        
        print(f"✅ Extracted - Headline: {len(headline)} chars, Body: {len(body_text)} chars, CTA: {len(call_to_action)} chars")
        
        return {
            'headline': headline or title,
            'body_text': body_text or create_fallback_content(field_values)['body_text'],
            'call_to_action': call_to_action or cta,
            'generated_at': datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"❌ Gemini API Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return create_fallback_content(field_values)

def extract_section(text, section_name):
    """Extract a specific section from the generated text"""
    
    patterns = [
        rf'{section_name}:\s*(.+?)(?=\n\n[A-Z_]+:|$)',
        rf'\*\*{section_name}\*\*:\s*(.+?)(?=\n\n\*\*[A-Z_]+\*\*:|$)',
        rf'{section_name}\s*:\s*(.+?)(?=\n\n[A-Z]|$)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
        if match:
            content = match.group(1).strip()
            content = re.sub(r'\*\*', '', content)
            content = re.sub(r'\n{3,}', '\n\n', content)
            return content
    
    return ''

def create_fallback_content(field_values):
    """Create detailed fallback content with DYNAMIC field handling"""
    
    title = (field_values.get('card_title') or 
            field_values.get('title') or 
            field_values.get('name') or 
            list(field_values.values())[0] if field_values else 'Your Topic')
    
    description = (field_values.get('main_description') or 
                  field_values.get('description') or 
                  field_values.get('content') or 
                  '')
    
    audience = (field_values.get('target_audience') or 
               field_values.get('audience') or 
               'your audience')
    
    cta = (field_values.get('call_to_action') or 
          field_values.get('cta') or 
          'Learn More')
    
    # Build dynamic content
    field_snippets = []
    for field_name, field_value in field_values.items():
        if field_value and str(field_value).strip() and field_name not in ['card_title', 'title', 'name']:
            field_snippets.append(str(field_value))
    
    additional_context = " ".join(field_snippets[:2]) if field_snippets else ""
    
    # Create fallback body - more natural and less repetitive
    fallback_body = f"""{title} is transforming how {audience} approach their goals and achieve success. {description if description else f'This approach addresses key challenges and provides practical solutions tailored for {audience}.'} {additional_context}

The implementation focuses on real-world applications and measurable outcomes. By understanding the unique needs of {audience}, this solution delivers targeted support that makes a genuine difference in daily operations and long-term planning.

Through continuous improvement and adaptation, the benefits extend beyond immediate results. {audience.capitalize()} gain access to resources and insights that empower informed decision-making and sustainable progress toward their objectives."""
    
    return {
        'headline': f"Transform Your Approach with {title}",
        'body_text': fallback_body,
        'call_to_action': cta,
        'generated_at': datetime.now().isoformat(),
        'fallback': True
    }

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    print(f"🤖 AI Generation Service starting on port {port}")
    print(f"📝 Using model: gemini-2.0-flash-exp")
    print(f"🔑 API Key configured: {bool(GEMINI_API_KEY)}")
    print(f"✨ Dynamic field handling enabled")
    app.run(host='0.0.0.0', port=port, debug=True)
