import google.generativeai as genai
import os
import re
from datetime import datetime

def generate_content_with_ai(field_values, style_selected):
    """
    Generate content using Google Gemini API with FULLY DYNAMIC field handling
    Strict validation prevents garbage output
    
    Args:  
        field_values (dict): Input field values (any fields, any names)
        style_selected (str): Tone/style for generation
    
    Returns: 
        dict:   Generated content with headline, body_text, call_to_action
    """
    
    # Configure Gemini API
    api_key = os.getenv('GEMINI_API_KEY')
    
    if not api_key:  
        raise Exception("GEMINI_API_KEY not found in environment variables")
    
    genai.configure(api_key=api_key)
    
    # ✅ STRICT validation - clean and assess input
    cleaned_values, quality_score = clean_and_assess_input(field_values)
    
    print(f"📊 Input quality score: {quality_score}/100")
    print(f"🧹 Cleaned fields: {len(cleaned_values)} meaningful fields")
    
    # If input is too poor, use fallback immediately - NO API CALL
    if quality_score < 30:
        print(f"⚠️ Input quality too low (score: {quality_score}) - using intelligent fallback")
        return create_intelligent_fallback(cleaned_values, style_selected)
    
    # Create model instance
    model = genai.GenerativeModel('gemini-2.0-flash-exp')
    
    # Build prompt with CLEANED data
    prompt = build_fully_dynamic_prompt(cleaned_values, style_selected)
    
    try:
        print(f"🤖 Generating with {len(cleaned_values)} fields in {style_selected} style")
        
        # Generate content
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.9,
                top_p=0.95,
                top_k=40,
                max_output_tokens=1500,
            )
        )
        
        # Parse response
        generated_text = response.text
        structured_content = parse_ai_response(generated_text, cleaned_values)
        
        # ✅ Validate output - check for repetition
        if is_output_low_quality(structured_content['body_text'], cleaned_values):
            print("⚠️ Generated content is low quality - using fallback")
            return create_intelligent_fallback(cleaned_values, style_selected)
        
        print(f"✅ Generated:  {len(structured_content['body_text'])} chars")
        
        return structured_content
        
    except Exception as e:
        print(f"❌ Gemini API Error: {str(e)}")
        return create_intelligent_fallback(cleaned_values, style_selected)

def clean_and_assess_input(field_values):
    """
    Clean input data and assess quality
    Returns:  (cleaned_dict, quality_score)
    """
    if not field_values:
        return {}, 0
    
    cleaned = {}
    score = 0
    total_chars = 0
    meaningful_count = 0
    
    # Patterns for junk/placeholder data
    junk_patterns = [
        r'^(hi+|hey+|test+|testing|n/? a|null|none|placeholder|example|sample)$',
        r'^[a-z]{1,2}$',  # Single/double letters
        r'^(. )\1{3,}$',  # Repeated chars:  aaaa, hihihi
        r'^(hi\s*){3,}$',  # "hi hi hi"
        r'^\d+$',  # Just numbers
    ]
    
    for field_name, field_value in field_values.items():
        if not field_value or not str(field_value).strip():
            continue
        
        value_str = str(field_value).strip()
        value_lower = value_str.lower()
        
        # Check if it's junk
        is_junk = any(re.match(pattern, value_lower) for pattern in junk_patterns)
        
        # Additional junk checks
        if len(value_str) < 3:
            is_junk = True
        
        # Check for excessive repetition within the value
        words = value_str.split()
        if len(words) > 2:
            unique_words = set(words)
            if len(unique_words) / len(words) < 0.3:  # Less than 30% unique
                is_junk = True
        
        if not is_junk:
            cleaned[field_name] = value_str
            meaningful_count += 1
            char_count = len(value_str)
            total_chars += char_count
            
            # Score based on length and meaningfulness
            if char_count > 10:
                score += 30
            elif char_count > 5:
                score += 15
            else:
                score += 5
    
    # Bonus for multiple meaningful fields
    if meaningful_count >= 3:
        score += 30
    elif meaningful_count == 2:
        score += 15
    elif meaningful_count == 1:
        score += 5
    
    # Bonus for substantial content
    if total_chars > 100:
        score += 20
    elif total_chars > 50:
        score += 10
    
    return cleaned, min(score, 100)

def is_output_low_quality(body_text, cleaned_values):
    """Check if AI output is low quality or repetitive"""
    
    if not body_text or len(body_text) < 100:
        return True
    
    text_lower = body_text.lower()
    
    # Check if output still contains obvious junk from input
    for value in cleaned_values.values():
        value_lower = str(value).lower()
        # If a short junk value appears many times
        if len(value_lower) < 10:
            count = text_lower.count(value_lower)
            if count > 5:  # Repeated more than 5 times
                return True
    
    # Split into sentences
    sentences = re.split(r'[.!?]+', body_text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 10]
    
    if len(sentences) < 3:
        return True
    
    # Check for sentence-level repetition
    sentence_starts = []
    for sentence in sentences: 
        words = sentence.lower().split()
        if len(words) >= 3:
            sentence_starts.append(' '.join(words[: 4]))  # First 4 words
    
    # If more than 40% of sentences start similarly
    if len(sentence_starts) > 2:
        unique_starts = len(set(sentence_starts))
        if unique_starts / len(sentence_starts) < 0.6:
            return True
    
    # Check for word-level excessive repetition
    words = text_lower.split()
    if len(words) > 20:
        word_freq = {}
        for word in words:
            if len(word) > 4:  # Only substantial words
                word_freq[word] = word_freq.get(word, 0) + 1
        
        if word_freq:
            max_freq = max(word_freq.values())
            # If any word appears more than 12% of the time
            if max_freq > len(words) * 0.12:
                return True
    
    return False

def build_fully_dynamic_prompt(cleaned_values, style):
    """Build prompt from CLEANED fields only"""
    
    style_instructions = {
        'professional': 'formal, professional, and authoritative - suitable for business communications',
        'casual': 'friendly, conversational, and relaxed with everyday language',
        'creative': 'imaginative, unique, and artistic with vivid descriptions and metaphors',
        'technical':  'detailed, precise, and technical with industry-specific terminology',
        'persuasive': 'convincing, compelling, and motivational focused on benefits and action'
    }
    
    style_desc = style_instructions.get(style, style_instructions['professional'])
    
    # If no meaningful data, give AI a generic task
    if not cleaned_values or len(cleaned_values) == 0:
        context = "Create engaging content about innovation, transformation, and achieving success in modern business."
    else:
        context_lines = []
        for field_name, field_value in cleaned_values.items():
            formatted_name = field_name.replace('_', ' ').replace('-', ' ').title()
            context_lines.append(f"• {formatted_name}: {field_value}")
        context = "\n".join(context_lines)
    
    prompt = f"""You are an expert content strategist. Create compelling, original content. 

**Context:**
{context}

**Writing Style:** {style_desc}

**CRITICAL INSTRUCTIONS:**
1. Identify the main subject from the context above
2. Write 3-4 COMPLETELY DIFFERENT paragraphs: 
   • Paragraph 1: Introduce the subject and its PRIMARY VALUE
   • Paragraph 2: Explain HOW IT WORKS or KEY FEATURES
   • Paragraph 3: Describe REAL-WORLD IMPACT and OUTCOMES  
   • Paragraph 4: Future possibilities or NEXT STEPS
3. NEVER EVER repeat the same word more than 2-3 times in the entire text
4. Use RICH VOCABULARY - synonyms, varied expressions, different phrasing
5. NO generic business clichés:  avoid "comprehensive", "cutting-edge", "proven", "solutions"
6. Each sentence must provide UNIQUE, NEW information
7. Use transitions but don't rehash previous points
8. Write as if educating an intelligent reader - be specific and insightful

**FORMAT (use exactly this structure):**

HEADLINE: [One powerful headline, 8-12 words]

BODY_TEXT: [3-4 diverse paragraphs, 280-350 words, each with distinct focus.  Maximize vocabulary variety.  Zero repetition.]

CALL_TO_ACTION: [One action phrase, 3-6 words]

IMPORTANT: If you find yourself using the same key terms repeatedly, STOP and rephrase with synonyms or alternative expressions."""
    
    return prompt

def parse_ai_response(ai_text, cleaned_values):
    """Parse AI response into structured format"""
    
    # Extract headline
    headline_match = re.search(r'HEADLINE:\s*(.+?)(?=\n\n|\nBODY)', ai_text, re.IGNORECASE)
    headline = headline_match.group(1).strip() if headline_match else None
    
    if headline:
        headline = re.sub(r'[\*\#\[\]\"]', '', headline).strip()
    
    if not headline or len(headline) < 5:
        headline = "Discover New Opportunities"
    
    # Extract body
    body_match = re.search(r'BODY_TEXT:\s*(.+?)(?=\n\nCALL_TO_ACTION:|$)', ai_text, re.IGNORECASE | re.DOTALL)
    body_text = body_match. group(1).strip() if body_match else None
    
    if body_text:
        body_text = re.sub(r'[\*\#]', '', body_text)
        body_text = re.sub(r'\n{3,}', '\n\n', body_text).strip()
    
    if not body_text or len(body_text) < 100:
        # Try to extract anything meaningful
        body_text = re.sub(r'(HEADLINE|BODY_TEXT|CALL_TO_ACTION):\s*', '', ai_text, flags=re.IGNORECASE)
        body_text = re.sub(r'\n{3,}', '\n\n', body_text).strip()
    
    # Extract CTA
    cta_match = re.search(r'CALL_TO_ACTION:\s*(. +?)$', ai_text, re. IGNORECASE | re.MULTILINE)
    call_to_action = cta_match.group(1).strip() if cta_match else "Get Started"
    call_to_action = re.sub(r'[\*\#\[\]\"]', '', call_to_action).strip()
    
    return {
        'headline': headline,
        'body_text': body_text,
        'call_to_action': call_to_action,
        'generated_at': datetime.utcnow().isoformat(),
        'full_text': ai_text
    }

def create_intelligent_fallback(cleaned_values, style):
    """Create high-quality fallback based on style"""
    
    # Try to find ANY meaningful content
    subject = None
    if cleaned_values:
        # Get longest value as subject
        values_by_length = sorted(cleaned_values.values(), key=lambda x: len(str(x)), reverse=True)
        if values_by_length:
            subject = str(values_by_length[0])
    
    # Style-specific professional content
    if style == 'professional':
        if subject:
            body = f"""Organizations today face unprecedented challenges in optimizing {subject}. Strategic implementation requires careful planning, stakeholder alignment, and measurable objectives that drive sustainable outcomes. 

Our methodology emphasizes evidence-based practices combined with adaptive frameworks. This approach enables teams to navigate complexity while maintaining focus on core priorities and operational excellence.

Results demonstrate significant improvements across key performance indicators.  Clients report enhanced efficiency, stronger competitive positioning, and increased capacity for innovation—benefits that compound over time through continuous refinement."""
            headline = f"Elevate Your {subject[: 40]} Strategy"
        else:
            body = """Strategic excellence demands more than conventional approaches. Organizations must embrace sophisticated frameworks that integrate operational efficiency with innovative thinking and measurable outcomes.

Implementation begins with comprehensive assessment of current capabilities, followed by customized roadmaps aligned to specific objectives. Each phase builds upon previous successes while incorporating lessons learned and emerging best practices.

Results speak for themselves: enhanced performance metrics, improved stakeholder satisfaction, and strengthened market position. These gains reflect our commitment to delivering sustainable value through proven methodologies and dedicated partnership."""
            headline = "Achieve Strategic Excellence"
        cta = "Schedule Consultation"
        
    elif style == 'casual': 
        if subject:
            body = f"""So you're interested in {subject}? Great choice! It's actually pretty amazing once you see how everything comes together.

What makes this different is how straightforward it is.  No complicated processes or confusing jargon—just practical tools and clear guidance that actually helps you get stuff done.

People love how quickly they see results. Plus, there's real support when you need it. It's like having an expert friend who's always got your back. Pretty cool, right?"""
            headline = f"Let's Talk About {subject[: 40]}"
        else:
            body = """Hey!  Looking for something that actually works? You're in the right place.  We've helped tons of people figure this out, and honestly, it's not as complicated as you might think.

Here's the deal: we focus on what matters.  No fluff, no overcomplicated nonsense. Just straightforward guidance and tools that make sense from day one.

The best part? Real results without the headache. People tell us all the time how much easier things got once they started.  Ready to see for yourself?"""
            headline = "Make Things Easier, Starting Now"
        cta = "Let's Chat"
        
    elif style == 'creative':
        if subject:
            body = f"""Imagine {subject} as a gateway to uncharted possibilities. Like an artist discovering new colors, you'll unlock dimensions previously hidden from view—each one revealing fresh pathways toward extraordinary achievement.

The journey itself becomes transformative. Every interaction weaves new threads into your tapestry of success, blending innovation with intuition in ways that surprise and inspire at every turn.

Your masterpiece awaits creation. The tools are ready, the canvas prepared, and the moment has arrived to paint your vision into reality with bold strokes of imagination."""
            headline = f"Reimagine {subject[:40]}"
        else:
            body = """Picture a landscape where possibilities bloom like wildflowers after spring rain. Each petal represents potential, each stem a pathway, each root a foundation for growth beyond imagination's current boundaries.

Innovation dances with tradition here, creating harmonies that resonate across dimensions of experience. What begins as curiosity transforms into mastery through journeys both challenging and exhilarating.

Your story deserves extraordinary chapters. The pen awaits your hand, the pages hunger for your words, and destiny whispers invitations to begin writing today."""
            headline = "Where Vision Becomes Reality"
        cta = "Begin Your Journey"
        
    elif style == 'technical':
        if subject:
            body = f"""The {subject} architecture leverages advanced algorithms and optimized data structures to maximize processing efficiency. System design incorporates modular components enabling scalable deployment across diverse operational environments.

Implementation utilizes industry-standard protocols with enhanced security layers and fault-tolerance mechanisms. Configuration parameters support granular customization while maintaining backward compatibility with legacy infrastructure.

Performance benchmarks indicate substantial improvements in throughput, latency reduction, and resource utilization.  Comprehensive API documentation and technical support facilitate seamless integration and ongoing system maintenance."""
            headline = f"Advanced {subject[:40]} Implementation"
        else:
            body = """System architecture employs distributed processing frameworks with load-balancing algorithms to optimize resource allocation. Core components utilize asynchronous communication protocols, ensuring high availability and fault tolerance across network boundaries.

Implementation specifications define strict adherence to industry standards while providing extensibility through plugin architectures. Configuration management supports environment-specific parameters without code modification requirements. 

Benchmark analyses demonstrate significant performance gains:  reduced latency profiles, improved throughput metrics, and enhanced scalability characteristics. Technical documentation includes API references, deployment guides, and troubleshooting procedures."""
            headline = "Enterprise-Grade Technical Solutions"
        cta = "Access Documentation"
        
    else:  # persuasive
        if subject:
            body = f"""Don't let another day pass without experiencing what {subject} can accomplish for you.  Thousands have already discovered these game-changing benefits—now it's your turn to join them and unlock success you've been missing.

The difference is remarkable. Within days, you'll notice improvements that others take months to achieve. That's the power of proven strategies combined with dedicated support at every step.

This opportunity won't wait forever. Take action now and position yourself among the leaders who refuse to settle for average results. Your breakthrough starts today."""
            headline = f"Transform Results with {subject[:40]}"
        else:
            body = """Imagine achieving in weeks what others struggle with for years. That's exactly what awaits when you take decisive action today.  Thousands have already discovered these powerful advantages—advantages now within your reach.

The impact is undeniable. Success stories pour in daily from people just like you who decided enough was enough. They stopped waiting, started doing, and never looked back.

Your moment is now. Don't let hesitation steal another opportunity. Join those who chose to win and discover what's possible when you commit to excellence."""
            headline = "Seize Your Competitive Edge Today"
        cta = "Claim Your Spot"
    
    return {
        'headline': headline[: 100],
        'body_text': body,
        'call_to_action': cta[: 50],
        'generated_at':  datetime.utcnow().isoformat(),
        'fallback':  True
    }