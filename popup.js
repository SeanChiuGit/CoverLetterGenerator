/**
 * Popup Script for Cover Letter Generator
 * Handles API key and resume management with PDF parsing support
 */

// Import PDF.js for PDF parsing
import * as pdfjsLib from './pdfjs/pdf.mjs';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdfjs/pdf.worker.mjs');

// DOM Elements
const apiKeyInput = document.getElementById('apiKey');
const saveApiKeyBtn = document.getElementById('saveApiKey');
const apiKeyStatus = document.getElementById('apiKeyStatus');

const resumeTextArea = document.getElementById('resumeText');
const parseResumeBtn = document.getElementById('parseResume');
const resumeFileInput = document.getElementById('resumeFile');
const uploadResumeBtn = document.getElementById('uploadResume');
const resumeStatus = document.getElementById('resumeStatus');

const tabs = document.querySelectorAll('.tab');
const pasteTab = document.getElementById('pasteTab');
const uploadTab = document.getElementById('uploadTab');

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    await loadStatus();
    setupEventListeners();
});

/**
 * Load and display current status
 */
async function loadStatus() {
    const { apiKey, resumeData } = await chrome.storage.local.get(['apiKey', 'resumeData']);

    // API Key Status - auto-detect provider from key
    if (apiKey) {
        const providerName = typeof getProviderNameFromKey === 'function'
            ? getProviderNameFromKey(apiKey)
            : 'Unknown';
        apiKeyStatus.className = 'status success';
        apiKeyStatus.innerHTML = `<span>API Key: ✓ Set (${providerName} detected)</span>`;
    } else {
        apiKeyStatus.className = 'status warning';
        apiKeyStatus.innerHTML = '<span>API Key: Not Set</span>';
    }

    // Resume Status
    if (resumeData && resumeData.name) {
        resumeStatus.className = 'status success';
        resumeStatus.innerHTML = `<span>Resume uploaded: <strong>${resumeData.name}</strong></span>`;
    } else {
        resumeStatus.className = 'status warning';
        resumeStatus.innerHTML = '<span>No resume uploaded</span>';
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Save API Key
    saveApiKeyBtn.addEventListener('click', saveApiKey);

    // Parse Resume from text
    parseResumeBtn.addEventListener('click', parseResumeFromText);

    // File upload
    resumeFileInput.addEventListener('change', handleFileSelect);
    uploadResumeBtn.addEventListener('click', uploadAndParseResume);

    // Tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            switchTab(targetTab);
        });
    });
}

/**
 * Save API Key (provider auto-detected from key format)
 */
async function saveApiKey() {
    const key = apiKeyInput.value.trim();

    if (!key) {
        showError(apiKeyStatus, 'Please enter an API key');
        return;
    }

    if (key.length < 10) {
        showError(apiKeyStatus, 'API key is too short');
        return;
    }

    try {
        // Auto-detect provider from key
        const providerName = typeof getProviderNameFromKey === 'function'
            ? getProviderNameFromKey(key)
            : 'Unknown';

        await chrome.storage.local.set({ apiKey: key });
        apiKeyInput.value = '';
        showSuccess(apiKeyStatus, `API Key saved! (${providerName} detected)`);
        await loadStatus();
    } catch (error) {
        showError(apiKeyStatus, 'Failed to save API key');
    }
}

/**
 * Parse resume from pasted text
 */
async function parseResumeFromText() {
    const resumeText = resumeTextArea.value.trim();

    if (!resumeText) {
        showError(resumeStatus, 'Please paste your resume text');
        return;
    }

    if (resumeText.length < 100) {
        showError(resumeStatus, 'Resume text is too short');
        return;
    }

    // Get API key (provider auto-detected)
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) {
        showError(resumeStatus, 'Please set your API key first');
        return;
    }

    // Show loading
    parseResumeBtn.disabled = true;
    parseResumeBtn.textContent = 'Parsing...';
    showInfo(resumeStatus, 'Parsing resume with AI...');

    try {
        // Use auto-detection version
        const resumeData = await parseResumeWithAIAuto(resumeText, apiKey);
        await chrome.storage.local.set({ resumeData });

        parseResumeBtn.disabled = false;
        parseResumeBtn.textContent = 'Parse & Save Resume';
        resumeTextArea.value = '';

        showSuccess(resumeStatus, `Resume parsed successfully! Found: ${resumeData.name}`);
        await loadStatus();
    } catch (error) {
        parseResumeBtn.disabled = false;
        parseResumeBtn.textContent = 'Parse & Save Resume';
        showError(resumeStatus, `Error: ${error.message}`);
    }
}

/**
 * Handle file selection
 */
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        uploadResumeBtn.disabled = false;
        const fileType = file.name.toLowerCase();
        let typeLabel = 'TXT';
        if (fileType.endsWith('.pdf')) typeLabel = 'PDF';
        else if (fileType.endsWith('.docx')) typeLabel = 'DOCX';
        uploadResumeBtn.textContent = `Upload ${typeLabel}: ${file.name}`;
    } else {
        uploadResumeBtn.disabled = true;
        uploadResumeBtn.textContent = 'Upload & Parse Resume';
    }
}

/**
 * Upload and parse resume file
 */
async function uploadAndParseResume() {
    const file = resumeFileInput.files[0];

    if (!file) {
        showError(resumeStatus, 'Please select a file');
        return;
    }

    // Get API key (provider auto-detected)
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) {
        showError(resumeStatus, 'Please set your API key first');
        return;
    }

    // Show loading
    uploadResumeBtn.disabled = true;
    uploadResumeBtn.textContent = 'Processing...';
    showInfo(resumeStatus, 'Processing resume file...');

    try {
        let resumeText;
        const fileType = file.name.toLowerCase();

        if (fileType.endsWith('.txt')) {
            // Handle text file
            resumeText = await readFileAsText(file);
        } else if (fileType.endsWith('.pdf')) {
            // Handle PDF file using PDF.js
            showInfo(resumeStatus, 'Extracting text from PDF...');
            resumeText = await parsePDF(file);
        } else if (fileType.endsWith('.docx')) {
            throw new Error('DOCX support coming soon. Please use PDF or TXT file.');
        } else {
            throw new Error('Unsupported file type. Please upload .pdf or .txt file.');
        }

        if (!resumeText || resumeText.trim().length < 100) {
            throw new Error('Resume text is too short. Please provide a complete resume.');
        }

        // Parse the resume text with AI (auto-detect provider)
        showInfo(resumeStatus, 'Parsing resume with AI...');
        const resumeData = await parseResumeWithAIAuto(resumeText, apiKey);
        await chrome.storage.local.set({ resumeData });

        uploadResumeBtn.textContent = 'Upload & Parse Resume';
        resumeFileInput.value = '';

        showSuccess(resumeStatus, `Resume uploaded successfully! Found: ${resumeData.name}`);
        await loadStatus();
    } catch (error) {
        uploadResumeBtn.disabled = false;
        uploadResumeBtn.textContent = 'Upload & Parse Resume';
        showError(resumeStatus, `Error: ${error.message}`);
    }
}

/**
 * Read file as text (for .txt files)
 */
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read text file'));
        reader.readAsText(file);
    });
}

/**
 * Parse PDF file and extract text using PDF.js
 */
async function parsePDF(file) {
    try {
        // Read file as ArrayBuffer
        const arrayBuffer = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read PDF file'));
            reader.readAsArrayBuffer(file);
        });

        // Load PDF document
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = '';
        const numPages = pdf.numPages;

        // Extract text from each page
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();

            // Concatenate text items
            const pageText = textContent.items
                .map(item => item.str)
                .join(' ');

            fullText += pageText + '\n\n';
        }

        // Clean up the text
        fullText = fullText
            .replace(/\s+/g, ' ')           // Normalize whitespace
            .replace(/\n\s+\n/g, '\n\n')    // Clean up extra newlines
            .trim();

        if (!fullText) {
            throw new Error('Could not extract text from PDF. The file may be image-based or encrypted.');
        }

        return fullText;
    } catch (error) {
        if (error.message.includes('extract text')) {
            throw error;
        }
        throw new Error(`PDF parsing failed: ${error.message}`);
    }
}

/**
 * Switch between tabs
 */
function switchTab(targetTab) {
    tabs.forEach(tab => {
        if (tab.dataset.tab === targetTab) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    if (targetTab === 'paste') {
        pasteTab.classList.add('active');
        uploadTab.classList.remove('active');
    } else {
        pasteTab.classList.remove('active');
        uploadTab.classList.add('active');
    }
}

/**
 * Status helpers
 */
function showSuccess(element, message) {
    element.className = 'status success';
    element.innerHTML = `<span>${message}</span>`;
}

function showError(element, message) {
    element.className = 'status error';
    element.innerHTML = `<span>${message}</span>`;
}

function showInfo(element, message) {
    element.className = 'status';
    element.style.background = '#e3f2fd';
    element.style.borderLeft = '4px solid #2196F3';
    element.style.color = '#1565c0';
    element.innerHTML = `<span>${message}</span>`;
}
