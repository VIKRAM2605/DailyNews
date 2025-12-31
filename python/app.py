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
        'model': 'gemini-1.5-flash',
        'api_key_configured': bool(GEMINI_API_KEY)
    })

@app.route('/api/generate', methods=['POST'])
def generate_content():
    try:
        data = request.get_json()
        
        if not data: 
            return jsonify({
                'success': False,
                'error':  'No data provided'
            }), 400
        
        field_values = data.get('field_values')
        style_selected = data.get('style_selected', 'professional')
        
        if not field_values:
            return jsonify({
                'success': False,
                'error':  'field_values is required'
            }), 400
        
        print(f"\n🚀 Generating content with style: {style_selected}")
        print(f"📝 Field values received: {list(field_values.keys())}")
        
        # Generate content using Gemini
        result = generate_with_gemini(field_values, style_selected)
        
        print(f"✅ Generated content successfully")
        print(f"   Headline: {result. get('headline', 'N/A')[:50]}...")
        print(f"   Body length: {len(result.get('body_text', ''))} chars")
        print(f"   Fallback used: {result.get('fallback', False)}")
        
        return jsonify({
            'success': True,
            'generated_content': result,
            'model': 'gemini-1.5-flash',
            'timestamp': result.get('generated_at')
        })
        
    except Exception as e:
        print(f"❌ Error in generate_content: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Return fallback content
        return jsonify({
            'success': True,
            'generated_content':  create_intelligent_fallback(field_values, style_selected),
        })

def clean_and_assess_input(field_values):
    """Clean input and assess quality - returns (cleaned_dict, score)"""
    if not field_values:
        return {}, 0
    
    cleaned = {}
    score = 0
    total_chars = 0
    meaningful_count = 0
    
    # EXPANDED Junk patterns - catch MORE variations
    junk_patterns = [
        r'^(hi+|hey+|test+|testing|n/?  a|null|none|placeholder|example|sample|general|audience|default|demo)$',
        r'^[a-z]{1,2}$',  # 1-2 letters only
        r'^(. )\1{3,}$',  # Repeated single char:  aaaa, hhhh  
        r'^(hi\s*){2,}$',  # "hi hi hi"
        r'^\d+$',  # Just numbers
        r'^(. {2,4})\1{2,}$',  # Pattern repetition:  hihi, testtest, hihihihi
        r'^(hi|test|demo).{0,10}(hi|test|demo)$',  # Variations with hi/test
        r'^[a-z]{2,10}(d{2,}|i{2,}|h{2,})$',  # Patterns like "hihihihidd"
    ]
    
    for field_name, field_value in field_values.items():
        if not field_value or not str(field_value).strip():
            continue
        
        value_str = str(field_value).strip()
        value_lower = value_str.lower()
        
        # Check if junk
        is_junk = any(re.match(pattern, value_lower) for pattern in junk_patterns)
        
        # Additional checks
        if len(value_str) < 4:  # Too short
            is_junk = True
        
        # Check for excessive character repetition (like "hihihihidd")
        char_counts = {}
        for char in value_lower:
            char_counts[char] = char_counts.get(char, 0) + 1
        if char_counts: 
            max_char_count = max(char_counts.values())
            if max_char_count > len(value_str) * 0.5:  # More than 50% is one char
                is_junk = True
        
        # Check for repetitive patterns
        if len(value_str) >= 4: 
            # Check if it's made of 2-3 char repeated patterns
            for pattern_len in [2, 3, 4]:
                if len(value_str) >= pattern_len * 2:
                    pattern = value_str[:pattern_len]
                    if value_str.replace(pattern, '').replace(pattern. upper(), '') == '' or \
                       len(value_str. replace(pattern, '')) < 3:
                        is_junk = True
                        break
        
        # Word repetition check
        words = value_str.split()
        if len(words) > 2:
            unique_words = set(words)
            if len(unique_words) / len(words) < 0.5:  # Less than 50% unique
                is_junk = True
        
        if not is_junk:
            cleaned[field_name] = value_str
            meaningful_count += 1
            char_count = len(value_str)
            total_chars += char_count
            
            if char_count > 20:
                score += 40
            elif char_count > 10:
                score += 25
            else:
                score += 10
    
    # Bonuses
    if meaningful_count >= 3:
        score += 35
    elif meaningful_count == 2:
        score += 20
    elif meaningful_count == 1:
        score += 5
    
    if total_chars > 150:
        score += 25
    elif total_chars > 80:
        score += 15
    
    return cleaned, min(score, 100)
    """Clean input and assess quality - returns (cleaned_dict, score)"""
    if not field_values:
        return {}, 0
    
    cleaned = {}
    score = 0
    total_chars = 0
    meaningful_count = 0
    
    # Junk patterns
    junk_patterns = [
        r'^(hi+|hey+|test+|testing|n/? a|null|none|placeholder|example|sample|general|audience)$',
        r'^[a-z]{1,2}$',  # 1-2 letters
        r'^(. )\1{3,}$',  # Repeated chars:  aaaa, hihihi  
        r'^(hi\s*){2,}$',  # "hi hi hi"
        r'^\d+$',  # Just numbers
        r'^(. {2,4})\1{2,}$',  # Pattern repetition:  "hihi", "testtest"
    ]
    
    for field_name, field_value in field_values.items():
        if not field_value or not str(field_value).strip():
            continue
        
        value_str = str(field_value).strip()
        value_lower = value_str.lower()
        
        # Check if junk
        is_junk = any(re.match(pattern, value_lower) for pattern in junk_patterns)
        
        if len(value_str) < 3:
            is_junk = True
        
        # Check for repetition within value
        words = value_str.split()
        if len(words) > 2:
            unique_words = set(words)
            if len(unique_words) / len(words) < 0.4:  # Less than 40% unique
                is_junk = True
        
        if not is_junk:
            cleaned[field_name] = value_str
            meaningful_count += 1
            char_count = len(value_str)
            total_chars += char_count
            
            if char_count > 15:
                score += 35
            elif char_count > 8:
                score += 20
            else:
                score += 8
    
    # Bonuses
    if meaningful_count >= 3:
        score += 30
    elif meaningful_count == 2:
        score += 15
    
    if total_chars > 100:
        score += 20
    elif total_chars > 50:
        score += 10
    
    return cleaned, min(score, 100)

def generate_with_gemini(field_values, style_selected):
    """Generate content using Google Gemini API with validation"""
    
    if not GEMINI_API_KEY: 
        print("⚠️ No API key, using fallback")
        return create_intelligent_fallback(field_values, style_selected)
    
    # Clean and assess input
    cleaned_values, quality_score = clean_and_assess_input(field_values)
    
    print(f"📊 Input quality score: {quality_score}/100")
    print(f"🧹 Cleaned:  {len(cleaned_values)} meaningful fields")
    
    # If too low quality, skip API call
    if quality_score < 35:
        print(f"⚠️ Quality too low ({quality_score}) - using fallback")
        return create_intelligent_fallback(cleaned_values, style_selected)
    
    try:
        # Style instructions
        style_map = {
            'professional': 'formal, professional, and authoritative',
            'casual': 'friendly, conversational, and relaxed',
            'creative': 'imaginative, unique, and artistic with vivid imagery',
            'technical': 'detailed, precise, with industry terminology',
            'persuasive': 'convincing, compelling, and action-oriented'
        }
        
        style_desc = style_map.get(style_selected, style_map['professional'])
        
        # Build context
        if not cleaned_values:
            context = "Create engaging content about business innovation and success."
        else:
            lines = []
            for name, value in cleaned_values.items():
                formatted = name.replace('_', ' ').title()
                lines.append(f"• {formatted}: {value}")
            context = "\n".join(lines)
        
        prompt = f"""You are an expert content writer.  Create compelling, original content. 

**Context:**
{context}

**Style:** {style_desc}

**STRICT RULES:**
1. Write 3-4 DISTINCT paragraphs, each covering a DIFFERENT aspect
2. NEVER repeat words more than twice in entire text
3. Use VARIED vocabulary throughout  - synonyms, different phrasings
4. NO business clichés:  avoid "comprehensive", "cutting-edge", "proven"
5. Each paragraph must discuss something NEW
6. Be specific and insightful, not generic

**FORMAT:**

HEADLINE: [8-12 words, compelling and specific]

BODY_TEXT: [3-4 diverse paragraphs, 280-350 words total, rich vocabulary, zero repetition]

CALL_TO_ACTION: [3-6 words, clear action]"""
        
        print(f"🤖 Calling Gemini API...")
        
        # Use stable model with better quota
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=1500,
                temperature=0.9,
                top_p=0.95,
                top_k=40
            )
        )
        
        generated_text = response.text
        print(f"📄 AI response length: {len(generated_text)} chars")
        
        # Parse
        headline = extract_section(generated_text, 'HEADLINE')
        body_text = extract_section(generated_text, 'BODY_TEXT')
        cta = extract_section(generated_text, 'CALL_TO_ACTION')
        
        # Validate output
        if not body_text or len(body_text) < 150:
            print(f"⚠️ Output too short, using fallback")
            return create_intelligent_fallback(cleaned_values, style_selected)
        
        return {
            'headline': headline or "Discover New Possibilities",
            'body_text':  body_text,
            'call_to_action': cta or "Learn More",
            'generated_at': datetime.now().isoformat()
        }
        
    except Exception as e: 
        print(f"❌ Gemini Error: {str(e)}")
        return create_intelligent_fallback(cleaned_values, style_selected)

def extract_section(text, section_name):
    """Extract section from generated text"""
    patterns = [
        rf'{section_name}:\s*(.+?)(?=\n\n[A-Z_]+:|$)',
        rf'\*\*{section_name}\*\*:\s*(.+?)(?=\n\n\*\*[A-Z_]+\*\*:|$)',
    ]
    
    for pattern in patterns:
        match = re. search(pattern, text, re. DOTALL | re.IGNORECASE)
        if match:
            content = match.group(1).strip()
            content = re.sub(r'[\*\#]', '', content)
            content = re.sub(r'\n{3,}', '\n\n', content)
            return content
    
    return ''

def create_intelligent_fallback(field_values, style):
    """Create quality fallback content based on style - NO junk usage"""
    
    # Clean input first
    cleaned, quality_score = clean_and_assess_input(field_values)
    
    # ✅ CRITICAL: Only use cleaned values if quality is decent
    subject = None
    if cleaned and quality_score >= 25:  # Only use if somewhat meaningful
        values = sorted(cleaned. values(), key=lambda x: len(str(x)), reverse=True)
        if values and len(str(values[0])) > 5:  # Must be substantial
            subject = str(values[0])[:60]
    
    # ✅ If subject is still junk-like, discard it
    if subject: 
        subject_lower = subject.lower()
        junk_indicators = ['hi', 'test', 'demo', 'placeholder', 'example']
        # If subject is mostly junk words
        if any(indicator * 2 in subject_lower for indicator in junk_indicators):
            subject = None
        # If subject has excessive repetition
        if subject and len(set(subject_lower)) < len(subject) * 0.3:  # Less than 30% unique chars
            subject = None
    
    # Style-specific content WITHOUT using junk
    if style == 'professional':
        if subject: 
            body = f"""Strategic initiatives around {subject} require comprehensive frameworks integrating operational excellence with innovative methodologies.  Organizations must balance efficiency optimization with adaptability to maintain competitive positioning.

Implementation begins with thorough capability assessments, stakeholder alignment, and customized roadmap development. Our evidence-based approach leverages industry insights while accommodating unique organizational requirements and constraints. 

Measurable outcomes demonstrate enhanced performance metrics, improved engagement levels, and strengthened market presence. These results emerge from systematic optimization combined with continuous refinement processes."""
            headline = f"Elevate Your {subject} Strategy"
        else:
            body = """Strategic transformation demands sophisticated frameworks that integrate operational efficiency with innovation capacity. Organizations must navigate complexity while maintaining focus on measurable objectives and sustainable outcomes.

Our methodology combines evidence-based practices with adaptive implementation strategies, enabling performance improvements across critical metrics.  This approach builds organizational resilience while delivering immediate value.

Clients experience substantial gains in efficiency, competitive positioning, and stakeholder satisfaction.  These benefits compound over time through continuous optimization and committed partnership approaches."""
            headline = "Transform Strategic Performance"
        cta = "Schedule Consultation"
        
    elif style == 'casual':
        if subject:
            body = f"""So you're interested in {subject}? Smart choice! Once you see how everything connects, it really clicks into place.

What sets this apart is the simplicity factor. No confusing procedures or technical jargon—just practical tools and straightforward guidance that actually helps you get stuff done.

People consistently mention how quickly they notice improvements. Plus, you've got solid support whenever questions pop up. It's like having a knowledgeable friend in your corner."""
            headline = f"Discover {subject} Made Simple"
        else: 
            body = """Looking for something that delivers without the complexity? You're in the right spot.  We focus on what actually matters and skip all the unnecessary fluff.

No overcomplicated systems or confusing terminology here. Just clear direction and useful resources that make sense from day one and keep delivering value.

The feedback speaks volumes:  people love how much easier their workflow becomes. Want to see what this could do for you? Let's make it happen."""
            headline = "Simplify Success Today"
        cta = "Let's Chat"
        
    elif style == 'creative':
        if subject:
            body = f"""Envision {subject} as your gateway to unexplored territories. Like an artist discovering new pigments, you'll unveil dimensions previously hidden from view—each revealing pathways toward extraordinary achievement.

Every interaction weaves fresh threads into your tapestry of success, blending innovation with intuition in patterns that surprise and inspire continuously throughout the journey.

Your masterpiece awaits its creator. The canvas stands prepared, tools lie ready, and this moment beckons you to transform vision into vivid reality through bold imaginative strokes."""
            headline = f"Reimagine Possibilities with {subject}"
        else:
            body = """Picture landscapes where opportunities flourish like wildflowers after spring rains. Each petal represents potential, every stem a pathway, all roots forming foundations for growth beyond current boundaries.

Innovation dances with tradition here, composing harmonies that resonate across experiential dimensions. What begins as curiosity transforms into mastery through journeys both challenging and exhilarating.

Your narrative deserves extraordinary chapters. The pen awaits your grasp, pages hunger for your words, and destiny whispers invitations to commence writing your story today."""
            headline = "Where Vision Becomes Reality"
        cta = "Begin Your Journey"
        
    elif style == 'technical': 
        if subject:
            body = f"""The {subject} architecture implements optimized algorithms with modular component design, enabling scalable deployment across heterogeneous operational environments and infrastructure configurations.

Technical specifications utilize industry-standard protocols enhanced with advanced fault-tolerance mechanisms. Configuration parameters support granular customization while maintaining backward compatibility with legacy systems.

Performance benchmarks demonstrate substantial throughput improvements, latency reductions, and optimized resource utilization. Comprehensive API documentation and technical support facilitate seamless integration procedures."""
            headline = f"Advanced {subject} Implementation"
        else:
            body = """System architecture employs distributed processing frameworks with sophisticated load-balancing algorithms to optimize resource allocation. Core components utilize asynchronous communication protocols ensuring high availability and fault tolerance.

Implementation specifications strictly adhere to industry standards while providing extensibility through plugin architectures. Configuration management supports environment-specific parameters without requiring code modifications.

Benchmark analyses reveal significant performance gains:  reduced latency profiles, enhanced throughput metrics, and improved scalability characteristics. Technical documentation includes comprehensive API references and deployment guides."""
            headline = "Enterprise Technical Solutions"
        cta = "Access Documentation"
        
    else:  # persuasive
        if subject:
            body = f"""Don't let another opportunity pass to discover what {subject} can accomplish for you. Thousands have already experienced game-changing benefits—now it's your turn to join them and unlock the success you deserve.

The transformation happens fast. Within days, you'll notice improvements that others spend months trying to achieve. That's the power of proven strategies combined with dedicated support at every step.

This opportunity won't wait indefinitely. Take decisive action now and position yourself among leaders who refuse to settle for mediocre results. Your breakthrough moment starts today."""
            headline = f"Transform Results with {subject}"
        else: 
            body = """Imagine achieving in weeks what others struggle with for years. That's exactly what awaits when you take decisive action today. Thousands have already discovered these powerful advantages—advantages now within your reach.

The impact speaks for itself. Success stories arrive daily from people who decided enough was enough. They stopped waiting, started executing, and never looked back on their old approaches.

Your moment has arrived. Don't let hesitation steal another opportunity from you. Join those who chose to win and discover what becomes possible through commitment to excellence."""
            headline = "Seize Your Competitive Edge"
        cta = "Claim Your Spot"
    
    return {
        'headline': headline[: 100],
        'body_text':  body,
        'call_to_action': cta[:50],
        'generated_at': datetime.now().isoformat(),
        'fallback': True
    }
if __name__ == '__main__': 
    port = int(os.getenv('PORT', 5001))
    print(f"🤖 AI Generation Service starting on port {port}")
    print(f"📝 Using model: gemini-1.5-flash")
    print(f"🔑 API Key configured: {bool(GEMINI_API_KEY)}")
    app.run(host='0.0.0.0', port=port, debug=True)