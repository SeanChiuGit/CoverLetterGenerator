/**
 * PDF Generation for Cover Letters
 * Professional formatting with standard US letter specifications
 */

function generatePDF(coverLetterText, userName) {
    const doc = new self.jspdf.jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter' // US Letter: 215.9mm × 279.4mm
    });

    // Professional cover letter formatting
    doc.setFont("Times", "normal");
    doc.setFontSize(12); // Standard 12pt font

    // Standard 1-inch margins (25.4mm)
    const leftMargin = 25.4;
    const rightMargin = 25.4;
    const topMargin = 25.4;
    const pageWidth = 215.9; // US Letter width
    const textWidth = pageWidth - leftMargin - rightMargin; // ~165mm

    let currentY = topMargin;

    // Add user's contact info at top (optional, can be enhanced)
    // This section can be expanded to include email/phone if desired

    // Add some spacing from top
    currentY += 5;

    // Split text into paragraphs for better formatting
    const paragraphs = coverLetterText.split('\n\n');

    paragraphs.forEach((paragraph) => {
        if (!paragraph.trim()) return;

        // Split paragraph into lines that fit the width
        const lines = doc.splitTextToSize(paragraph.trim(), textWidth);

        // Check if we need a new page
        if (currentY + (lines.length * 7) > 254) { // 254mm is ~1 inch from bottom
            doc.addPage();
            currentY = topMargin;
        }

        // Add the paragraph
        doc.text(lines, leftMargin, currentY, {
            align: 'left',
            lineHeightFactor: 1.5 // 1.5 line spacing
        });

        // Move down for next paragraph
        currentY += (lines.length * 7) + 5; // 7mm per line + 5mm paragraph spacing
    });

    // Return blob for download
    return doc.output("blob");
}
