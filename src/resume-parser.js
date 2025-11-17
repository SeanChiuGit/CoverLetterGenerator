/**
 * Resume Parser Utility
 * Extracts structured information from resume text using AI
 */

/**
 * Parse resume with automatic provider detection
 * @param {string} resumeText - Raw resume text
 * @param {string} apiKey - API key (provider auto-detected)
 * @returns {Promise<Object>} - Parsed resume data
 */
async function parseResumeWithAIAuto(resumeText, apiKey) {
    // Use auto-detection
    return await parseResumeWithAI(resumeText, apiKey);
}

async function parseResumeWithAI(resumeText, apiKey, provider = 'openai', model = null) {
    const parsePrompt = `Extract structured information from this resume and return ONLY valid JSON.

Resume:
${resumeText}

Return this exact JSON structure (fill in what you find, use null for missing fields):
{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "phone number or null",
  "education": "Degree, Major, University, Graduation Year",
  "skills": "Comma-separated list of technical skills",
  "experience": [
    {
      "company": "Company Name",
      "title": "Job Title",
      "duration": "Date range",
      "description": "Brief description of key achievements"
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Brief description",
      "technologies": "Technologies used"
    }
  ],
  "summary": "2-3 sentence professional summary"
}

Return ONLY the JSON, no markdown, no explanation.`;

    try {
        // Use auto-detection if no specific provider given
        let extractedText;
        if (provider === 'openai' && !model && typeof callAPIWithAutoDetect === 'function') {
            // Auto-detect provider from API key
            extractedText = await callAPIWithAutoDetect(
                apiKey,
                [{ role: "user", content: parsePrompt }],
                0.1,
                model
            );
        } else {
            // Use specified provider
            extractedText = await callAPI(
                provider,
                apiKey,
                [{ role: "user", content: parsePrompt }],
                0.1,
                model
            );
        }

        // Remove markdown code blocks if present
        const cleanedText = extractedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        const resumeData = JSON.parse(cleanedText);
        resumeData.rawText = resumeText; // Store original for reference

        return resumeData;
    } catch (error) {
        throw new Error(`Failed to parse resume: ${error.message}`);
    }
}

/**
 * Read file as text
 */
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error("Failed to read file"));
        reader.readAsText(file);
    });
}

/**
 * Read PDF file (requires pdf.js library)
 * For simplicity in popup context, we'll use a workaround
 */
async function extractTextFromPDF(file) {
    // For Chrome extension popup, we'll use a simple approach:
    // Ask user to copy-paste or use a third-party API
    // Alternatively, use pdf.js library (requires additional setup)

    throw new Error("PDF parsing requires the user to copy-paste text. Please upload a .txt file or paste resume text directly.");
}

/**
 * Main function to handle resume file upload
 */
async function processResumeFile(file, apiKey) {
    let resumeText;

    const fileType = file.name.toLowerCase();

    if (fileType.endsWith('.txt')) {
        resumeText = await readFileAsText(file);
    } else if (fileType.endsWith('.pdf')) {
        // For production, you'd integrate pdf.js or use an API
        throw new Error("PDF upload not supported yet. Please paste your resume text directly or upload a .txt file.");
    } else if (fileType.endsWith('.docx')) {
        throw new Error("DOCX upload not supported yet. Please paste your resume text directly or upload a .txt file.");
    } else {
        throw new Error("Unsupported file type. Please upload .txt file or paste text directly.");
    }

    if (!resumeText || resumeText.trim().length < 50) {
        throw new Error("Resume text is too short. Please provide a complete resume.");
    }

    // Parse the resume using AI
    return await parseResumeWithAI(resumeText, apiKey);
}
