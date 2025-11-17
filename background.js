/**
 * Background Service Worker for Universal Cover Letter Generator
 * Works on ALL websites using info.selectionText (no content scripts needed)
 */

importScripts("jspdf.umd.min.js");
importScripts("generate-pdf.js");
importScripts("api-providers.js");

// Create context menu on installation
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "generate_cover_letter_pdf",
        title: "Generate Cover Letter PDF",
        contexts: ["selection"]
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info) => {
    if (info.menuItemId !== "generate_cover_letter_pdf") return;

    try {
        // Get selected text directly from context menu - works everywhere!
        const jobText = info.selectionText || "";

        if (!jobText) {
            showNotification("No Selection", "Please select job description text first.");
            return;
        }

        // Retrieve stored data
        const { apiKey, resumeData } = await chrome.storage.local.get(['apiKey', 'resumeData']);

        // Validation
        if (!apiKey) {
            showNotification("API Key Missing", "Please set your API key in the extension popup.");
            return;
        }

        if (!resumeData || !resumeData.name) {
            showNotification("Resume Missing", "Please upload your resume in the extension popup first.");
            return;
        }

        // Show processing notification
        showNotification("Processing", "Generating your cover letter...");

        // Extract company and role from job description (auto-detect provider)
        const { company, role } = await extractJobInfoAuto(jobText, apiKey);

        // Generate cover letter (auto-detect provider)
        const coverLetter = await generateCoverLetterAuto(jobText, resumeData, apiKey);

        // Create PDF
        const pdfBlob = generatePDF(coverLetter, resumeData.name);

        // Download PDF
        await downloadPDF(pdfBlob, resumeData.name, company, role);

        // Success notification
        showNotification("Success!", `Cover letter PDF generated for ${company} - ${role}`);

    } catch (error) {
        console.error("Cover letter generation error:", error);
        showNotification("Error", error.message || "Failed to generate cover letter");
    }
});

/**
 * Extract company and role with auto-detection
 */
async function extractJobInfoAuto(jobText, apiKey) {
    return await extractJobInfo(jobText, apiKey);
}

/**
 * Generate cover letter with auto-detection
 */
async function generateCoverLetterAuto(jobDescription, resumeData, apiKey) {
    return await generateCoverLetter(jobDescription, resumeData, apiKey);
}

/**
 * Extract company and role from job description using AI
 */
async function extractJobInfo(jobText, apiKey, provider = 'openai', model = null) {
    const extractionPrompt = `Extract the company name and job title from this job description.

Job Description:
${jobText}

Return ONLY valid JSON in this exact format:
{"company": "CompanyName", "role": "JobTitle"}

Rules:
- If company is not mentioned, use "Company"
- Keep names short and filesystem-safe (alphanumeric only)
- No special characters except underscores`;

    try {
        // Use auto-detection if no specific provider given
        let extracted;
        if (provider === 'openai' && !model && typeof callAPIWithAutoDetect === 'function') {
            extracted = await callAPIWithAutoDetect(
                apiKey,
                [{ role: "user", content: extractionPrompt }],
                0.1,
                model
            );
        } else {
            extracted = await callAPI(
                provider,
                apiKey,
                [{ role: "user", content: extractionPrompt }],
                0.1,
                model
            );
        }

        // Clean and parse JSON
        const cleanedText = extracted.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleanedText);

        return {
            company: (parsed.company || "Company").replace(/[^a-zA-Z0-9]/g, '_'),
            role: (parsed.role || "Position").replace(/[^a-zA-Z0-9]/g, '_')
        };
    } catch (error) {
        console.error("Job info extraction error:", error);
        return { company: "Company", role: "Position" };
    }
}

/**
 * Generate cover letter using resume data and job description
 */
async function generateCoverLetter(jobDescription, resumeData, apiKey, provider = 'openai', model = null) {
    // Build resume context
    const resumeContext = buildResumeContext(resumeData);

    const coverLetterPrompt = `You are writing a professional cover letter for a job application.

APPLICANT INFORMATION:
${resumeContext}

JOB DESCRIPTION:
${jobDescription}

INSTRUCTIONS:
Write a polished, professional cover letter (150-200 words) following this structure:

1. **Opening Paragraph** (2-3 sentences)
   - Address the hiring manager professionally
   - State the specific role being applied for
   - Express genuine interest in the company/position

2. **Middle Paragraph** (3-4 sentences)
   - Highlight 3-4 relevant skills/experiences from the resume that match the job
   - Use ONLY real experiences from the applicant information above
   - Provide specific examples and achievements
   - Connect skills directly to job requirements

3. **Closing Paragraph** (2 sentences)
   - Reinforce enthusiasm and fit
   - Express interest in next steps
   - Professional sign-off

CRITICAL RULES:
- Use ONLY information from the applicant information above
- DO NOT invent experiences, companies, or projects
- Keep length between 150-200 words
- Use confident, warm, professional tone
- Sign off with: "Sincerely,\\n${resumeData.name}"
- Output ONLY the cover letter text, no headings or metadata

Generate the cover letter now:`;

    try {
        // Use auto-detection if no specific provider given
        let letter;
        if (provider === 'openai' && !model && typeof callAPIWithAutoDetect === 'function') {
            letter = await callAPIWithAutoDetect(
                apiKey,
                [{ role: "user", content: coverLetterPrompt }],
                0.5,
                model
            );
        } else {
            letter = await callAPI(
                provider,
                apiKey,
                [{ role: "user", content: coverLetterPrompt }],
                0.5,
                model
            );
        }

        return letter.trim();
    } catch (error) {
        throw new Error(`Failed to generate cover letter: ${error.message}`);
    }
}

/**
 * Build resume context string from resumeData
 */
function buildResumeContext(resumeData) {
    let context = `Name: ${resumeData.name}\n`;

    if (resumeData.email) {
        context += `Email: ${resumeData.email}\n`;
    }

    if (resumeData.phone) {
        context += `Phone: ${resumeData.phone}\n`;
    }

    context += `\nEDUCATION:\n${resumeData.education || 'Not specified'}\n`;

    context += `\nSKILLS:\n${resumeData.skills || 'Not specified'}\n`;

    if (resumeData.experience && Array.isArray(resumeData.experience) && resumeData.experience.length > 0) {
        context += `\nWORK EXPERIENCE:\n`;
        resumeData.experience.forEach((exp, idx) => {
            context += `${idx + 1}. ${exp.title} at ${exp.company} (${exp.duration})\n`;
            if (exp.description) {
                context += `   ${exp.description}\n`;
            }
        });
    }

    if (resumeData.projects && Array.isArray(resumeData.projects) && resumeData.projects.length > 0) {
        context += `\nPROJECTS:\n`;
        resumeData.projects.forEach((proj, idx) => {
            context += `${idx + 1}. ${proj.name}\n`;
            if (proj.description) {
                context += `   ${proj.description}\n`;
            }
            if (proj.technologies) {
                context += `   Technologies: ${proj.technologies}\n`;
            }
        });
    }

    if (resumeData.summary) {
        context += `\nPROFESSIONAL SUMMARY:\n${resumeData.summary}\n`;
    }

    return context;
}

/**
 * Download PDF with proper filename
 */
async function downloadPDF(pdfBlob, userName, company, role) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onloadend = function() {
            // Clean up name for filename
            const cleanName = userName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
            const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

            const filename = `CoverLetter_${cleanName}_${company}_${role}_${timestamp}.pdf`;

            chrome.downloads.download({
                url: reader.result,
                filename: filename,
                saveAs: false
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(downloadId);
                }
            });
        };

        reader.onerror = function() {
            reject(new Error("Failed to process PDF"));
        };

        reader.readAsDataURL(pdfBlob);
    });
}

/**
 * Show notification to user
 */
function showNotification(title, message) {
    chrome.notifications.create({
        type: "basic",
        iconUrl: "icon.png",
        title: title,
        message: message
    });
}
