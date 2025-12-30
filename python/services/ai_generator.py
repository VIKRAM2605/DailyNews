import google.generativeai as genai
import os
import re
from datetime import datetime

def generate_content_with_ai(field_values, style_selected):
    """
    Generate content using Google Gemini API
    
    Args:
        field_values (dict): Input field values
        style_selected (str): Tone/style for generation
    
    Returns:
        dict: Generated content with headline, body_text, call_to_action
    """
    
    # Configure Gemini API
    api_key = os.getenv('GEMINI_API_KEY')
    
    if not api_key:
        raise Exception("GEMINI_API_KEY not found in environment variables")
    
    genai.configure(api_key=api_key)
    
    # Create model instance
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    # Build prompt
    prompt = build_prompt(field_values, style_selected)
    
    try:
        # Generate content
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                top_p=0.95,
                top_k=40,
                max_output_tokens=1024,
            )
        )
        
        # Parse response
        generated_text = response.text
        structured_content = parse_ai_response(generated_text, field_values)
        
        return structured_content
        
    except Exception as e:
        print(f"Gemini API Error: {str(e)}")
        # Return fallback content
        return create_fallback_content(field_values)

def build_prompt(field_values, style):
    """Build prompt from field values"""
    
    card_title = field_values.get('card_title', 'N/A')
    main_description = field_values.get('main_description', 'N/A')
    target_audience = field_values.get('target_audience', 'N/A')
    key_message = field_values.get('key_message', 'N/A')
    
    prompt = f"""You are a {style} content generator. Generate engaging content based on:

Title: {card_title}
Description: {main_description}
Target Audience: {target_audience}
Key Message: {key_message}

Generate the following in {style} tone:
1. A compelling headline (max 10 words)
2. Body text (2-3 paragraphs, engaging and clear)
3. A strong call-to-action (max 5 words)

Format your response EXACTLY as:
HEADLINE: [your headline]
BODY: [your body text]
CTA: [your call to action]"""
    
    return prompt

def parse_ai_response(ai_text, field_values):
    """Parse AI response into structured format"""
    
    # Extract headline
    headline_match = re.search(r'HEADLINE:\s*(.+?)(?=\n|BODY:|$)', ai_text, re.IGNORECASE)
    headline = headline_match.group(1).strip() if headline_match else field_values.get('card_title', 'Generated Headline')
    
    # Extract body text
    body_match = re.search(r'BODY:\s*(.+?)(?=\nCTA:|$)', ai_text, re.IGNORECASE | re.DOTALL)
    body_text = body_match.group(1).strip() if body_match else ai_text
    
    # Extract call to action
    cta_match = re.search(r'CTA:\s*(.+?)$', ai_text, re.IGNORECASE)
    call_to_action = cta_match.group(1).strip() if cta_match else 'Learn More'
    
    return {
        'headline': headline,
        'body_text': body_text,
        'call_to_action': call_to_action,
        'generated_at': datetime.utcnow().isoformat(),
        'full_text': ai_text
    }

def create_fallback_content(field_values):
    """Create fallback content if AI fails"""
    
    return {
        'headline': field_values.get('card_title', 'Generated Headline'),
        'body_text': field_values.get('main_description', 'Generated content based on your inputs.'),
        'call_to_action': field_values.get('call_to_action', 'Learn More'),
        'generated_at': datetime.utcnow().isoformat(),
        'fallback': True
    }
