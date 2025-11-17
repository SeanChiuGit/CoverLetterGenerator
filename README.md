# Universal AI Cover Letter Generator

A production-ready Chrome extension that generates personalized cover letter PDFs for **ANY user** using AI. Works on all websites, including CSP-restricted sites.

## Features

- **Universal**: Works for any user with any resume
- **No Content Scripts**: Uses `info.selectionText` - works on ALL websites
- **Multi-Provider Support**: OpenAI, Groq, Anthropic, Gemini, and more
- **Automatic Provider Detection**: Just enter your API key - provider is auto-detected from key format
- **AI-Powered Resume Parsing**: Automatically extracts structured data from resumes
- **PDF Resume Support**: Upload PDF resumes directly (via PDF.js)
- **Smart Job Extraction**: Identifies company name and role from job descriptions
- **Professional PDFs**: Standard US letter format with proper margins and spacing
- **Secure**: API keys and resume data stored locally

## How It Works

### Architecture Overview

```
User Input (Popup)
    |
Resume Text/PDF -> AI Parser -> Structured Data -> chrome.storage.local
    |
User selects job text on any website
    |
Right-click -> "Generate Cover Letter PDF"
    |
background.js:
    1. Reads selected text via info.selectionText
    2. Retrieves resumeData + apiKey from storage
    3. Auto-detects AI provider from API key format
    4. Extracts company/role from job description (AI)
    5. Generates cover letter using resumeData (AI)
    6. Creates PDF with jsPDF
    7. Downloads: CoverLetter_UserName_Company_Role_Date.pdf
```

### Key Design Decisions

1. **No Content Scripts**
   - Uses `chrome.contextMenus` with `info.selectionText`
   - Works on CSP-restricted sites (Gmail, banking sites, etc.)
   - No message passing needed
   - No injection failures

2. **AI-Powered Resume Parsing**
   - Accepts PDF files (.pdf) or plain text (.txt)
   - Uses AI to extract structured data (provider auto-detected)
   - Stores: name, email, phone, education, skills, experience, projects
   - Smart fallback for missing fields

3. **Dynamic Cover Letter Generation**
   - No hardcoded personal information
   - Uses ONLY data from user's resume
   - Tailored to each job description
   - Professional 3-paragraph format

4. **Intelligent Filename**
   - Format: `CoverLetter_UserName_CompanyName_JobTitle_YYYYMMDD.pdf`
   - Sanitized for filesystem compatibility
   - Includes date for organization

5. **Automatic Provider Detection**
   - Single API key input field
   - Provider detected from key prefix (sk-, gsk_, sk-ant-, etc.)
   - No manual configuration needed

## Setup Instructions

### For Users

1. **Install the Extension**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extension folder

2. **Configure in Popup**
   - Click extension icon
   - Enter your API key (provider is automatically detected from key format)
   - Paste your resume text or upload PDF/TXT file
   - Click "Parse & Save Resume"

3. **Generate Cover Letters**
   - Go to any job posting website
   - Select the job description text
   - Right-click -> "Generate Cover Letter PDF"
   - PDF downloads automatically

### For Developers

**File Structure:**
```
coverlettergenerator/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (main logic)
├── popup.html            # User interface
├── popup.js              # UI logic (ES module)
├── api-providers.js      # Multi-provider API abstraction
├── resume-parser.js      # AI resume parsing
├── generate-pdf.js       # PDF generation (jsPDF wrapper)
├── jspdf.umd.min.js     # jsPDF library
├── pdfjs/               # PDF.js for resume parsing
│   ├── pdf.mjs
│   └── pdf.worker.mjs
├── icon.png             # Extension icon
└── README.md            # This file
```

**Dependencies:**
- jsPDF (included): Cover letter PDF generation
- PDF.js (included): Resume PDF text extraction
- AI API (user-provided key): Supports OpenAI, Groq, Anthropic, Gemini, and more

## Technical Details

### Resume Data Structure

```javascript
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "123-456-7890",
  "education": "B.S. Computer Science, XYZ University, 2024",
  "skills": "Python, JavaScript, React, Node.js",
  "experience": [
    {
      "company": "Tech Corp",
      "title": "Software Engineer",
      "duration": "2022-2024",
      "description": "Built scalable web applications..."
    }
  ],
  "projects": [
    {
      "name": "Project Alpha",
      "description": "Machine learning platform",
      "technologies": "Python, TensorFlow"
    }
  ],
  "summary": "Experienced software engineer...",
  "rawText": "Original resume text..."
}
```

### API Calls

The extension supports **multiple AI providers** through a unified abstraction layer with automatic detection.

**Supported Providers (Auto-Detected):**

| Provider | Default Model | Key Prefix | Auto-Detection |
|----------|--------------|------------|----------------|
| **OpenAI** | gpt-4o-mini | `sk-...` | Default for `sk-` keys |
| **OpenRouter** | openai/gpt-4o-mini | `sk-or-...` | Detected by `sk-or-` prefix |
| **Groq** | llama-3.1-70b-versatile | `gsk_...` | Detected by `gsk_` prefix |
| **Anthropic** | claude-3-haiku-20240307 | `sk-ant-...` | Detected by `sk-ant-` prefix |
| **Google Gemini** | gemini-1.5-flash | `AIzaSy...` | Detected by `AIzaSy` or 39-char keys |
| **DeepSeek** | deepseek-chat | `sk-...` | Falls back to OpenAI format |
| **Together.ai** | meta-llama/Llama-3-70b-chat-hf | (long alphanumeric) | Detected by length >40, no hyphens |
| **X.AI (Grok)** | - | `xai-...` | Detected by `xai-` prefix |

**Automatic Provider Detection:**

The extension automatically detects your AI provider based on your API key format:
- `sk-ant-...` -> Anthropic (Claude)
- `sk-or-...` -> OpenRouter
- `gsk_...` -> Groq
- `xai-...` -> X.AI (Grok)
- `AIzaSy...` -> Google Gemini
- `sk-...` -> OpenAI (default)
- Long alphanumeric (40+ chars, no hyphens) -> Together.ai

**No configuration needed** - just paste your API key and the extension handles the rest!

**Provider-Specific Notes:**

- **OpenAI, OpenRouter, Groq, DeepSeek, Together.ai**: Use standard OpenAI chat completions format
- **Anthropic**: Uses Messages API with different request/response structure
- **Google Gemini**: Uses generateContent API with distinct format
- Model selection is automatic using each provider's default model

**API Call Types:**

1. **Resume Parsing** (resume-parser.js via popup.js)
   - Temperature: 0.1 (deterministic)
   - Purpose: Extract structured JSON data from resume text

2. **Job Info Extraction** (background.js)
   - Temperature: 0.1 (deterministic)
   - Purpose: Extract company name and job title for filename

3. **Cover Letter Generation** (background.js)
   - Temperature: 0.5 (creative but controlled)
   - Purpose: Write personalized professional cover letter

### Storage

Uses `chrome.storage.local` for:
- `apiKey`: API key (string) - provider auto-detected from format
- `resumeData`: Parsed resume object (JSON)

**Storage limits:**
- Max 10MB per extension
- Synced across devices if using Chrome sync

## Customization

### Modify Cover Letter Format

Edit background.js to change:
- Word count (currently 150-200)
- Paragraph structure
- Tone and style
- Sign-off format

### Modify PDF Styling

Edit generate-pdf.js to change:
- Font (currently Times New Roman)
- Font size (currently 12pt)
- Margins (currently 1 inch)
- Line spacing (currently 1.5)

### Add New API Provider

Edit api-providers.js to add new providers:
1. Add provider config to `API_PROVIDERS` object
2. Specify baseUrl, defaultModel, keyPrefix, headerFormat, requestFormat
3. Update `detectProviderFromKey()` function to recognize the new key format
4. Provider will be automatically available without UI changes

## Security & Privacy

- **API Key**: Stored locally, only transmitted to your chosen AI provider
- **Resume Data**: Stored locally only, never uploaded anywhere
- **No Analytics**: Extension doesn't track usage
- **No External Services**: Only communicates with your AI provider's API

## Troubleshooting

**Problem**: "API Key Missing" error
- **Solution**: Open popup and save your API key

**Problem**: "Resume Missing" error
- **Solution**: Upload resume in popup and click "Parse & Save Resume"

**Problem**: Resume parsing fails
- **Solution**: Ensure resume is complete (100+ characters) and API key is valid

**Problem**: PDF download fails
- **Solution**: Check Chrome download permissions in settings

**Problem**: Cover letter quality is poor
- **Solution**: Improve resume details; AI generates based on provided info

**Problem**: Provider not detected correctly
- **Solution**: Extension defaults to OpenAI format. For ambiguous keys (like DeepSeek with sk- prefix), the OpenAI-compatible format will be used.

## Future Enhancements

- [x] Support PDF resume uploads (via PDF.js)
- [x] Multi-provider support with auto-detection
- [ ] Support DOCX resume uploads
- [ ] Add resume templates
- [ ] Cover letter preview before download
- [ ] Custom prompts/templates
- [ ] History of generated letters
- [ ] Export to Google Docs

## License

Open source - feel free to modify and distribute

## Credits

- Built with jsPDF (https://github.com/parallax/jsPDF)
- PDF parsing with PDF.js (https://mozilla.github.io/pdf.js/)
- Powered by multiple AI providers (OpenAI, Anthropic, Groq, Gemini, etc.)
- Designed for universal accessibility

---

**Version**: 3.0
**Last Updated**: 2025
**Manifest Version**: 3
