import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1.2";
import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2";
import { html, render } from "https://cdn.jsdelivr.net/npm/lit-html@3.1.0/lit-html.js";
import { unsafeHTML } from "https://cdn.jsdelivr.net/npm/lit-html@3.1.0/directives/unsafe-html.js";
import { dashboardTemplate } from "./templates.js";

// State management
const state = {
    llmConfig: JSON.parse(localStorage.getItem('llm-config') || 'null'),
    updates: JSON.parse(localStorage.getItem('team-updates') || '[]'),
    generatedContent: JSON.parse(localStorage.getItem('generated-content') || 'null'),
    isGenerating: false,
    streamingContent: null,
    prompts: {}
};

// Utilities
const $ = id => document.getElementById(id);
const save = (key, data) => localStorage.setItem(key, JSON.stringify(data));
// Unified notification function (replaces old showAlert)
const showAlert = (message, type = 'success') => {
    showToast(message, type);
};

// Load text files
const loadText = async (path) => {
    try {
        const response = await fetch(path);
        return await response.text();
    } catch (error) {
        console.error(`Failed to load ${path}:`, error);
        return '';
    }
};


const updateUI = () => {
    const configBtn = $('config-btn');
    configBtn.innerHTML = state.llmConfig ? '<i class="bi bi-check-circle"></i> LLM Configured' : '<i class="bi bi-gear"></i> Configure LLM';
    configBtn.className = state.llmConfig ? 'btn btn-success' : 'btn btn-outline-primary';
    
    // Update export button visibility
    const exportBtn = $('export-btn');
    if (state.updates.length > 0) {
        exportBtn.style.display = 'inline-block';
    } else {
        exportBtn.style.display = 'none';
    }
    
    // Update last update date if element exists
    const lastUpdateElement = $('last-update-date');
    if (lastUpdateElement && state.updates.length > 0) {
        lastUpdateElement.textContent = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
    }

    const initialForm = $('initial-form');
    const dashboardContent = $('dashboard-content');
    
    if (state.updates.length === 0) {
        initialForm.classList.remove('d-none');
        dashboardContent.classList.add('d-none');
    } else {
        initialForm.classList.add('d-none');
        dashboardContent.classList.remove('d-none');
        render(dashboardTemplate(state, { clearAllUpdates, showInputForm, generateSummary, removeUpdate }), dashboardContent);
    }
};

const showInputForm = () => {
    if (state.updates.length === 0) {
        $('initial-form').classList.remove('d-none');
        $('dashboard-content').classList.add('d-none');
    } else {
        // Show modal for adding updates when in dashboard view
        const modal = new bootstrap.Modal($('addUpdateModal'));
        modal.show();
    }
};

const configureLLM = async (autoShow = false) => {
    const configBtn = $('config-btn');
    configBtn.disabled = true;
    
    state.llmConfig = await openaiConfig({
        title: "Configure AI Provider",
        help: autoShow ? '<div class="alert alert-info"><i class="bi bi-info-circle"></i> Please configure your AI provider</div>' : '',
        show: autoShow || !state.llmConfig,
        defaultBaseUrls: ["https://api.openai.com/v1", "https://api.anthropic.com/v1", "https://openrouter.ai/api/v1"],
        storage: localStorage, key: "llm-config", baseUrlLabel: "API Base URL", apiKeyLabel: "API Key", buttonLabel: "Save & Configure"
    });
    
    save('llm-config', state.llmConfig);
    showAlert('LLM configuration saved successfully');
    updateUI();
    configBtn.disabled = false;
};

// Shared function for adding updates
const addUpdate = async (teamName, period, content, isModalForm = false) => {
    if (!teamName || !period || !content) {
        showAlert('Please fill in all required fields', 'danger');
        return false;
    }
    
    const isFirstUpdate = state.updates.length === 0;
    state.updates.push({ id: Date.now().toString(), teamName, period, content, timestamp: new Date().toISOString() });
    save('team-updates', state.updates);
    updateUI();
    
    // Auto-generate AI summary when adding updates
    if (state.llmConfig && !state.isGenerating) {
        setTimeout(() => {
            generateSummary();
        }, 500); // Small delay to ensure UI update is complete
    }
    
    showAlert('Update added successfully');
    return true;
};

const handleUpdateSubmit = async e => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const submitText = submitBtn.querySelector('.submit-text');
    const submitSpinner = submitBtn.querySelector('.submit-spinner');
    
    submitBtn.disabled = true;
    submitText.textContent = 'Adding...';
    submitSpinner.classList.remove('d-none');
    
    const [teamName, period, content] = ['team-name', 'update-period', 'update-content'].map(id => $(id).value.trim());
    
    const success = await addUpdate(teamName, period, content);
    if (success) {
        e.target.reset();
    }
    
    submitBtn.disabled = false;
    submitText.textContent = 'Add Update';
    submitSpinner.classList.add('d-none');
};

const clearAllUpdates = () => {
    if (!state.updates.length || !confirm('Are you sure you want to clear all updates?')) return;
    state.updates = [];
    state.generatedContent = null;
    save('team-updates', state.updates);
    save('generated-content', state.generatedContent);
    updateUI();
    showAlert('All updates cleared');
};

const generateSummary = async () => {
    if (!state.llmConfig || !state.updates.length || state.isGenerating) return;
    state.isGenerating = true;
    updateUI();
    await streamLLMResponse();
    state.isGenerating = false;
    updateUI();
    showAlert('Summary generated successfully');
};

const streamLLMResponse = async () => {
    let fullContent = '', previousContent = '';

    if (!state.prompts.summaryGeneration) {
        state.prompts.summaryGeneration = await loadText('./prompts/summary-generation.md');
    }

    const updatesText = state.updates.map(({ teamName, period, timestamp, content }) => 
        `**Team: ${teamName}** (${period})\nDate: ${new Date(timestamp).toLocaleDateString()}\n${content}\n\n`).join('');

    const prompt = state.prompts.summaryGeneration.replace('{{UPDATES_CONTENT}}', updatesText);

    state.streamingContent = { summary: '', nextSteps: '', risks: [], milestones: [], pmTeam: '', sponsor: '' };

    for await (const { content } of asyncLLM(`${state.llmConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.llmConfig.apiKey}` },
        body: JSON.stringify({ model: 'gpt-4o', stream: true, messages: [{ role: 'user', content: prompt }] })
    })) {
        if (content) {
            fullContent = content.includes(previousContent) && content.length > previousContent.length ? content : fullContent + content;
            previousContent = fullContent;
            
            try {
                const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const jsonResponse = JSON.parse(jsonMatch[0]);
                    state.generatedContent = jsonResponse;
                    save('generated-content', state.generatedContent);
                    updateUI();
                }
            } catch (e) {
                updatePartialContent(fullContent);
            }
        }
    }
};
const updatePartialContent = (content) => {
    const summaryMatch = content.match(/"summary":\s*"([^"]*(?:\\.[^"]*)*)"/);
    const nextStepsMatch = content.match(/"nextSteps":\s*"([^"]*(?:\\.[^"]*)*)"/);
    
    if (summaryMatch?.[1]) {
        const summary = summaryMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t');
        if (summary !== state.generatedContent?.summary) {
            state.generatedContent = { ...state.generatedContent, summary };
            updateUI();
        }
    }
    
    if (nextStepsMatch?.[1]) {
        const nextSteps = nextStepsMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t');
        if (nextSteps !== state.generatedContent?.nextSteps) {
            state.generatedContent = { ...state.generatedContent, nextSteps };
            updateUI();
        }
    }
};

const removeUpdate = id => {
    state.updates = state.updates.filter(update => update.id !== id);
    save('team-updates', state.updates);
    updateUI();
    showAlert('Update removed');
};

const handleModalSubmit = async () => {
    const submitBtn = $('modal-submit-btn');
    const submitText = submitBtn.querySelector('.modal-submit-text');
    const submitSpinner = submitBtn.querySelector('.modal-submit-spinner');
    
    submitBtn.disabled = true;
    submitText.textContent = 'Adding...';
    submitSpinner.classList.remove('d-none');
    
    const [teamName, period, content] = ['modal-team-name', 'modal-update-period', 'modal-update-content'].map(id => $(id).value.trim());
    
    const success = await addUpdate(teamName, period, content, true);
    if (success) {
        // Reset form and close modal
        ['modal-team-name', 'modal-update-period', 'modal-update-content'].forEach(id => $(id).value = '');
        bootstrap.Modal.getInstance($('addUpdateModal')).hide();
    }
    
    submitBtn.disabled = false;
    submitText.textContent = 'Add Update';
    submitSpinner.classList.add('d-none');
};

const resetToInitialState = () => {
    if (confirm('Clear all updates and return to start?')) {
        ['team-updates', 'generated-content'].forEach(k => localStorage.removeItem(k));
        location.reload();
    }
};

// Export to PPTX functionality
const exportToPPTX = async () => {
    const exportBtn = $('export-btn');
    const originalHTML = exportBtn.innerHTML;
    
    try {
        // Show loading state
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Generating...';
        
        // Check if dashboard content exists
        const dashboardContent = $('dashboard-content');
        if (!dashboardContent || dashboardContent.classList.contains('d-none')) {
            showToast('No dashboard content to export. Please add updates first.', 'warning');
            exportBtn.disabled = false;
            exportBtn.innerHTML = originalHTML;
            return;
        }
        
        // Create a complete export container with proper PPT-sized layout
        const exportContainer = document.createElement('div');
        exportContainer.style.position = 'fixed';
        exportContainer.style.top = '-9999px';
        exportContainer.style.left = '-9999px';
        exportContainer.style.width = '1920px'; // Standard PPT width (16:9 ratio)
        exportContainer.style.height = '1080px'; // Standard PPT height (16:9 ratio)
        exportContainer.style.backgroundColor = 'white';
        exportContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        exportContainer.style.fontSize = '14px'; // Readable font size
        exportContainer.style.lineHeight = '1.4';
        exportContainer.style.color = '#333';
        exportContainer.style.display = 'flex';
        exportContainer.style.flexDirection = 'column';
        exportContainer.style.overflow = 'hidden';
        
        // Add essential CSS styles for proper rendering
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            .title-bar { 
                background: linear-gradient(270deg, #015CFE 0%, #030067 100%); 
                color: white; 
                padding: 0.5rem 0; 
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                font-size: 14px;
            }
            .dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
            .dot.red { background: #dc3545; }
            .dot.yellow { background: #ffc107; }
            .dot.green { background: #198754; }
            .dot.blue { background: #0d6efd; }
            .circle { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
            .circle.green { background: #198754; }
            .circle.blue { background: #0d6efd; }
            .overall-status { 
                background: #198754; 
                color: white; 
                padding: 0.5rem 1rem; 
                border-radius: 0.25rem; 
                font-weight: bold; 
            }
            .status-dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; margin-right: 0.5rem; }
            .status-dot.red { background: #dc3545; }
            .status-dot.yellow { background: #ffc107; }
            .status-dot.green { background: #198754; }
            .status-dot.blue { background: #0d6efd; }
            .card-header.bg-primary { 
                background: linear-gradient(270deg, #015CFE 0%, #030067 100%) !important; 
                color: white;
            }
            .footer-bar {
                background: #F2F2F2;
                color: #000;
                padding: 0.5rem;
                box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
                font-size: 10px;
            }
            .legend-separator {
                width: 1px;
                height: 60px;
                background-color: rgba(255, 255, 255, 0.3);
                align-self: center;
            }
            .card { margin-bottom: 0.75rem; border: 1px solid #dee2e6; border-radius: 0.375rem; }
            .card-header { padding: 0.5rem 0.75rem; background-color: rgba(0,0,0,.03); border-bottom: 1px solid #dee2e6; font-size: 14px; }
            .card-body { padding: 0.75rem; }
            .table { width: 100%; margin-bottom: 0.5rem; color: #212529; font-size: 12px; border-collapse: collapse; table-layout: fixed; }
            .table th, .table td { padding: 0.5rem; border: 1px solid #dee2e6; text-align: left; vertical-align: top; word-wrap: break-word; white-space: normal; }
            .table th { background-color: #015CFE; color: white; font-weight: bold; text-align: center; vertical-align: middle; }
            .table-primary th { background-color: #015CFE !important; color: white !important; border-color: #015CFE !important; }
            .table tbody tr:nth-child(even) { background-color: #f8f9fa; }
            .table tbody tr:nth-child(odd) { background-color: white; }
            .table td:first-child { width: 50%; line-height: 1.3; }
            .table td:not(:first-child) { width: auto; text-align: center; }
            .row { display: flex; flex-wrap: wrap; margin-right: -0.75rem; margin-left: -0.75rem; }
            .col, .col-1, .col-2, .col-3, .col-4, .col-5, .col-6, .col-7, .col-8, .col-9, .col-10, .col-11, .col-12, .col-lg-6 { position: relative; width: 100%; padding-right: 0.75rem; padding-left: 0.75rem; }
            .col-lg-6 { flex: 0 0 auto; width: 50%; }
            .col-3 { flex: 0 0 auto; width: 25%; }
            .col-2 { flex: 0 0 auto; width: 16.66667%; }
            .col-1 { flex: 0 0 auto; width: 8.33333%; }
            .d-flex { display: flex !important; }
            .justify-content-between { justify-content: space-between !important; }
            .align-items-center { align-items: center !important; }
            .fw-bold { font-weight: 700 !important; }
            .text-white { color: #fff !important; }
            .text-white-50 { color: rgba(255, 255, 255, 0.5) !important; }
            .text-muted { color: #6c757d !important; }
            .mb-0 { margin-bottom: 0 !important; }
            .mb-3 { margin-bottom: 1rem !important; }
            .mb-4 { margin-bottom: 1rem !important; }
            .me-2 { margin-right: 0.5rem !important; }
            .me-3 { margin-right: 1rem !important; }
            .me-4 { margin-right: 1.5rem !important; }
            .ms-2 { margin-left: 0.5rem !important; }
            .px-3 { padding-left: 1rem !important; padding-right: 1rem !important; }
            .py-3 { padding-top: 0.75rem !important; padding-bottom: 0.75rem !important; }
            h4 { font-size: 16px !important; margin-bottom: 0.75rem !important; }
            h6 { font-size: 14px !important; margin-bottom: 0.5rem !important; }
            .border-bottom { border-bottom: 1px solid #dee2e6 !important; }
            .text-center { text-align: center !important; }
            .card-body .row { display: flex !important; align-items: flex-start !important; min-height: 40px !important; }
            .card-body .row .col { display: flex !important; align-items: flex-start !important; padding: 0.5rem !important; border-right: 1px solid #dee2e6 !important; word-wrap: break-word !important; white-space: normal !important; }
            .card-body .row .col:first-child { max-width: 50% !important; line-height: 1.3 !important; flex-direction: column !important; }
            .card-body .row .col:not(:first-child) { justify-content: center !important; align-items: center !important; text-align: center !important; }
            .card-body .row .col:last-child { border-right: none !important; }
            .card-body .row.mx-0 { margin-left: 0 !important; margin-right: 0 !important; }
            .status-dot { vertical-align: middle !important; }
            .col-lg-6:first-child h4 { margin-bottom: 0.5rem !important; }
            .col-lg-6:first-child h6 { margin-bottom: 0.4rem !important; }
            .col-lg-6:first-child .mb-4 { margin-bottom: 0.75rem !important; }
            .status-update-container > div { margin-bottom: 0.75rem !important; }
        `;
        exportContainer.appendChild(styleElement);
        
        // Clone and add the header (fixed to top)
        const originalHeader = document.querySelector('.title-bar');
        if (originalHeader) {
            const headerClone = originalHeader.cloneNode(true);
            // Remove buttons from header for export
            const buttons = headerClone.querySelectorAll('button');
            buttons.forEach(btn => btn.remove());
            
            // Fix header styling for export - compact version
            headerClone.style.position = 'relative';
            headerClone.style.left = 'auto';
            headerClone.style.right = 'auto';
            headerClone.style.marginLeft = 'auto';
            headerClone.style.marginRight = 'auto';
            headerClone.style.width = '100%';
            headerClone.style.height = '80px'; // Fixed height for header
            headerClone.style.flexShrink = '0';
            headerClone.style.padding = '0.5rem 0'; // Reduced padding
            headerClone.style.fontSize = '14px'; // Smaller font for header
            
            exportContainer.appendChild(headerClone);
        }
        
        // Create main content area with proper sizing
        const mainContent = document.createElement('div');
        mainContent.style.flex = '1';
        mainContent.style.padding = '15px 30px';
        mainContent.style.maxWidth = '100%';
        mainContent.style.overflow = 'hidden';
        mainContent.style.height = 'calc(100% - 160px)'; // Reserve space for header (80px) and footer (80px)
        mainContent.style.fontSize = '14px'; // Readable font size
        mainContent.innerHTML = dashboardContent.innerHTML;
        
        // Fix text stretching and layout issues in main content
        const allElements = mainContent.querySelectorAll('*');
        allElements.forEach(element => {
            // Prevent text from stretching horizontally
            if (element.style) {
                element.style.maxWidth = '100%';
                element.style.wordWrap = 'break-word';
                element.style.overflowWrap = 'break-word';
            }
        });
        
        // Fix status update container for export - remove scroll and fit content
        const statusUpdateContainer = mainContent.querySelector('.status-update-container');
        if (statusUpdateContainer) {
            statusUpdateContainer.style.height = 'auto'; // Let content determine height
            statusUpdateContainer.style.overflow = 'visible';
            statusUpdateContainer.style.maxHeight = 'none';
        }
        
        // Optimize layout for better space usage
        const leftColumn = mainContent.querySelector('.col-lg-6:first-child');
        const rightColumn = mainContent.querySelector('.col-lg-6:last-child');
        
        if (leftColumn && rightColumn) {
            // Make columns more balanced and remove excessive spacing
            leftColumn.style.paddingRight = '10px';
            rightColumn.style.paddingLeft = '10px';
            
            // Reduce vertical spacing in left column specifically
            const leftColumnElements = leftColumn.querySelectorAll('h4, h6, .mb-3, .mb-4, div[style*="margin-left"]');
            leftColumnElements.forEach(element => {
                if (element.tagName === 'H4') {
                    element.style.marginBottom = '0.5rem';
                }
                if (element.tagName === 'H6') {
                    element.style.marginBottom = '0.4rem';
                }
                if (element.classList.contains('mb-3') || element.classList.contains('mb-4')) {
                    element.style.marginBottom = '0.5rem';
                }
                // Reduce spacing for the achieved and next steps content areas
                if (element.style.marginLeft === '1.5rem') {
                    element.style.marginBottom = '0.75rem';
                }
            });
            
            // Reduce spacing in the status update container
            const statusUpdateContainer = leftColumn.querySelector('.status-update-container');
            if (statusUpdateContainer) {
                const sections = statusUpdateContainer.querySelectorAll('.mb-4, div:has(h6)');
                sections.forEach(section => {
                    section.style.marginBottom = '0.75rem';
                });
            }
        }
        
        // Adjust card spacing for better fit
        const cards = mainContent.querySelectorAll('.card');
        cards.forEach(card => {
            card.style.marginBottom = '0.75rem';
        });
        
        // Fix table styling and alignment
        const tables = mainContent.querySelectorAll('.table');
        tables.forEach(table => {
            table.style.fontSize = '12px';
            table.style.marginBottom = '0.5rem';
            table.style.borderCollapse = 'collapse';
            table.style.width = '100%';
        });
        
        // Fix table headers specifically
        const tableHeaders = mainContent.querySelectorAll('.table th');
        tableHeaders.forEach(th => {
            th.style.backgroundColor = '#015CFE';
            th.style.color = 'white';
            th.style.textAlign = 'center';
            th.style.verticalAlign = 'middle';
            th.style.fontWeight = 'bold';
            th.style.border = '1px solid #015CFE';
        });
        
        // Fix table cells alignment
        const tableCells = mainContent.querySelectorAll('.table td');
        tableCells.forEach(td => {
            td.style.textAlign = 'left';
            td.style.verticalAlign = 'top'; // Changed to top for better text wrapping
            td.style.border = '1px solid #dee2e6';
            td.style.padding = '0.5rem';
            td.style.wordWrap = 'break-word';
            td.style.overflowWrap = 'break-word';
            td.style.whiteSpace = 'normal'; // Allow text wrapping
        });
        
        // Fix the custom risk/milestone table rows
        const customRows = mainContent.querySelectorAll('.row.border-bottom, .row.mx-0');
        customRows.forEach(row => {
            row.style.alignItems = 'flex-start'; // Changed to flex-start for better text wrapping
            row.style.minHeight = '40px';
            row.style.borderBottom = '1px solid #dee2e6';
            
            // Fix column alignment within these rows
            const cols = row.querySelectorAll('.col, [class*="col-"]');
            cols.forEach((col, index) => {
                col.style.display = 'flex';
                col.style.alignItems = 'flex-start'; // Changed to flex-start
                col.style.padding = '0.5rem';
                col.style.borderRight = '1px solid #dee2e6';
                col.style.wordWrap = 'break-word';
                col.style.overflowWrap = 'break-word';
                col.style.whiteSpace = 'normal';
                
                // Special handling for first column (description column)
                if (index === 0) {
                    col.style.flexDirection = 'column';
                    col.style.justifyContent = 'flex-start';
                    col.style.lineHeight = '1.3';
                    col.style.maxWidth = '60%'; // Limit width to force wrapping
                }
            });
            
            // Remove border from last column
            const lastCol = cols[cols.length - 1];
            if (lastCol) {
                lastCol.style.borderRight = 'none';
            }
        });
        
        // Remove edit buttons and interactive elements from the clone
        const editButtons = mainContent.querySelectorAll('button, [style*="cursor: pointer"]');
        editButtons.forEach(btn => {
            if (btn.tagName === 'BUTTON') {
                btn.remove();
            } else {
                btn.style.cursor = 'default';
                btn.removeAttribute('title');
                btn.onclick = null;
            }
        });
        
        // Hide specific DOM elements from screenshot
        const cardHeaders = mainContent.querySelectorAll('.card-header h6');
        cardHeaders.forEach(header => {
            if (header.textContent.includes('Status Update:')) {
                header.closest('.card').style.display = 'none';
            }
        });
        
        exportContainer.appendChild(mainContent);
        
        // Clone and add the footer at the bottom (fixed to bottom)
        const originalFooter = document.querySelector('.footer-bar');
        if (originalFooter) {
            const footerClone = originalFooter.cloneNode(true);
            
            // Fix footer styling for export - compact version
            footerClone.style.position = 'relative';
            footerClone.style.bottom = 'auto';
            footerClone.style.left = 'auto';
            footerClone.style.right = 'auto';
            footerClone.style.width = '100%';
            footerClone.style.height = '80px'; // Fixed height for footer
            footerClone.style.flexShrink = '0';
            footerClone.style.marginTop = '0';
            footerClone.style.zIndex = 'auto';
            footerClone.style.padding = '0.5rem'; // Reduced padding
            footerClone.style.fontSize = '10px'; // Smaller font for footer
            
            // Make footer content more compact
            const footerItems = footerClone.querySelectorAll('.footer-item');
            footerItems.forEach(item => {
                const h6 = item.querySelector('h6');
                const p = item.querySelector('p');
                if (h6) {
                    h6.style.fontSize = '11px';
                    h6.style.marginBottom = '0.1rem';
                }
                if (p) {
                    p.style.fontSize = '10px';
                    p.style.lineHeight = '1.2';
                }
            });
            
            // Remove interactive elements from footer
            const footerButtons = footerClone.querySelectorAll('[style*="cursor: pointer"]');
            footerButtons.forEach(btn => {
                btn.style.cursor = 'default';
                btn.removeAttribute('title');
                btn.onclick = null;
            });
            
            exportContainer.appendChild(footerClone);
        }
        
        document.body.appendChild(exportContainer);
        
        // Generate high-quality screenshot using SnapDOM with better settings
        const canvas = await snapdom.toCanvas(exportContainer, {
            backgroundColor: 'white',
            scale: 1.5,    // Optimal scale for quality vs performance
            embedFonts: true,
            quality: 1.0,  // Maximum quality
            useCORS: true,
            allowTaint: false
        });
        
        // Clean up the temporary container
        document.body.removeChild(exportContainer);
        
        // Create PPTX
        const pptx = new PptxGenJS();
        
        // Add title slide first
        const titleSlide = pptx.addSlide();
        titleSlide.addText('Team Updates Dashboard', {
            x: 1,
            y: 2,
            w: 8,
            h: 1.5,
            fontSize: 36,
            bold: true,
            color: '333333',
            align: 'center'
        });
        
        titleSlide.addText(`Generated on ${new Date().toLocaleDateString()}`, {
            x: 1,
            y: 4,
            w: 8,
            h: 0.5,
            fontSize: 16,
            color: '666666',
            align: 'center'
        });
        
        // Add slide with the screenshot - optimized for full layout
        const slide = pptx.addSlide();
        
        // Convert canvas to high-quality base64 PNG
        const imageData = canvas.toDataURL('image/png', 1.0); // Maximum quality
        
        // Standard PowerPoint slide dimensions (16:9 ratio)
        // Since we created a 1920x1080 container, it should fit perfectly
        slide.addImage({
            data: imageData,
            x: 0,
            y: 0,
            w: 10, // Full slide width
            h: 5.625, // Full slide height (16:9 ratio: 10 * 9/16 = 5.625)
            sizing: {
                type: 'cover' // Fill the entire slide
            }
        });
        
        // Generate and download PPTX
        const fileName = `team-updates-${new Date().toISOString().split('T')[0]}.pptx`;
        await pptx.writeFile({ fileName });
        
        showToast('PPTX exported successfully!', 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        showToast('Failed to export PPTX. Please try again.', 'danger');
    } finally {
        // Restore button state
        exportBtn.disabled = false;
        exportBtn.innerHTML = originalHTML;
    }
};

// Show toast notification
const showToast = (message, type = 'success') => {
    const toastId = 'copy-toast-' + Date.now();
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-triangle'} me-2"></i>
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    
    // Create toast container if it doesn't exist
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
    }
    
    container.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
    bsToast.show();
    
    // Remove toast element after it's hidden
    toast.addEventListener('hidden.bs.toast', () => toast.remove());
};

// Edit content functionality - Modal-based approach
window.editContent = (elementId, field) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    // Get current value from state
    let currentValue = '';
    if (state.generatedContent && state.generatedContent[field]) {
        currentValue = state.generatedContent[field];
    }
    
    // Create modal for editing
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'editModal';
    modal.tabIndex = -1;
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Edit ${field === 'summary' ? 'Achieved Content' : field === 'nextSteps' ? 'Next Steps' : field === 'documentLinks' ? 'Document Links' : field}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <textarea class="form-control" id="editTextarea" rows="8" placeholder="Enter content (Markdown supported)...">${currentValue}</textarea>
                    <div class="form-text mt-2">You can use Markdown formatting (e.g., **bold**, *italic*, - lists)</div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="saveEditBtn">Save</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
    
    // Focus textarea after modal is shown
    modal.addEventListener('shown.bs.modal', () => {
        document.getElementById('editTextarea').focus();
    });
    
    // Save functionality
    document.getElementById('saveEditBtn').onclick = () => {
        const newValue = document.getElementById('editTextarea').value.trim();
        
        // Save to state
        if (!state.generatedContent) state.generatedContent = {};
        state.generatedContent[field] = newValue;
        save('generated-content', state.generatedContent);
        
        bootstrapModal.hide();
        updateUI();
        showToast('Content updated successfully!', 'success');
    };
    
    // Clean up modal when hidden
    modal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal);
    });
};

// Inline edit functionality for simple text fields - Fixed version
window.editInlineContent = (elementId, field) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const currentText = element.textContent.trim();
    if (currentText === 'To be generated') return; // Don't edit placeholder
    
    // Create modal for inline editing
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'inlineEditModal';
    modal.tabIndex = -1;
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Edit ${field}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <input type="text" class="form-control" id="inlineEditInput" value="${currentText}" placeholder="Enter ${field}">
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="saveInlineBtn">Save</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
    
    // Focus input after modal is shown
    modal.addEventListener('shown.bs.modal', () => {
        const input = document.getElementById('inlineEditInput');
        input.focus();
        input.select();
    });
    
    // Save functionality
    document.getElementById('saveInlineBtn').onclick = () => {
        const newValue = document.getElementById('inlineEditInput').value.trim();
        if (newValue) {
            // Save to state
            if (!state.generatedContent) state.generatedContent = {};
            state.generatedContent[field] = newValue;
            save('generated-content', state.generatedContent);
            showToast('Content updated successfully!', 'success');
        }
        
        bootstrapModal.hide();
        updateUI();
    };
    
    // Handle Enter key
    document.getElementById('inlineEditInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('saveInlineBtn').click();
        }
    });
    
    // Clean up modal when hidden
    modal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal);
    });
};

// Copy content functionality
window.copyContent = async (elementId) => {
    const element = document.getElementById(elementId);
    if (!element) {
        showToast('Content not found', 'danger');
        return;
    }
    
    let textContent = '';
    let sectionName = '';
    
    // Get section name from the card header
    const card = element.closest('.card');
    if (card) {
        const header = card.querySelector('.card-header h6');
        sectionName = header ? header.textContent.trim() : 'Content';
    }
    
    if (element.tagName === 'TABLE' || element.querySelector('table')) {
        const table = element.tagName === 'TABLE' ? element : element.querySelector('table');
        const rows = Array.from(table.querySelectorAll('tr'));
        textContent = rows.map(row => {
            const cells = Array.from(row.querySelectorAll('th, td'));
            return cells.map(cell => cell.textContent.trim()).join('\t');
        }).join('\n');
    } else {
        textContent = element.textContent.trim();
    }
    
    if (!textContent || textContent === 'Generate summary to see next steps' || 
        textContent === 'Add team updates and generate summary to see content' ||
        textContent.includes('Generate summary to see')) {
        showToast('No content available to copy', 'warning');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(textContent);
        showToast(`${sectionName} copied to clipboard!`, 'success');
        
        // Find and update the button that was clicked
        const buttons = document.querySelectorAll('button[title="Copy content"]');
        for (const btn of buttons) {
            if (btn.onclick && btn.onclick.toString().includes(elementId)) {
                const original = btn.innerHTML;
                btn.innerHTML = '<i class="bi bi-check"></i>';
                btn.classList.add('btn-success');
                btn.classList.remove('btn-outline-secondary');
                setTimeout(() => {
                    btn.innerHTML = original;
                    btn.classList.remove('btn-success');
                    btn.classList.add('btn-outline-secondary');
                }, 1500);
                break;
            }
        }
    } catch (err) {
        console.error('Failed to copy content:', err);
        showToast('Failed to copy content to clipboard', 'danger');
    }
};

// Table content editing functionality - Modal-based approach
window.editTableContent = (elementId, field) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    // Get current data
    let currentData = state.generatedContent?.[field] || [];
    
    // Create modal for table editing
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'tableEditModal';
    modal.tabIndex = -1;
    
    let placeholder = '';
    let currentValue = '';
    
    if (field === 'risks') {
        placeholder = `Enter risks in this format (one per line):
Risk description | Due date | Owner | Status (High/Medium/Low)

Example:
Data migration delay | 2024-01-15 | John Doe | High
Budget approval pending | 2024-01-20 | Jane Smith | Medium`;
        
        if (currentData.length > 0) {
            currentValue = currentData.map(risk => 
                `${risk.description} | ${risk.dueBy} | ${risk.owner} | ${risk.ra}`
            ).join('\n');
        }
    } else if (field === 'milestones') {
        placeholder = `Enter milestones in this format (one per line):
Milestone name | Forecast date | Status

Example:
System deployment | 2024-02-01 | On track
User training completion | 2024-02-15 | In progress`;
        
        if (currentData.length > 0) {
            currentValue = currentData.map(milestone => 
                `${milestone.milestone} | ${milestone.forecastDate} | ${milestone.status}`
            ).join('\n');
        }
    }
    
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Edit ${field === 'risks' ? 'Risks & Issues' : 'Milestones'}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <textarea class="form-control" id="tableEditTextarea" rows="10" style="font-family: monospace;" placeholder="${placeholder}">${currentValue}</textarea>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="saveTableBtn">Save</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
    
    // Focus textarea after modal is shown
    modal.addEventListener('shown.bs.modal', () => {
        document.getElementById('tableEditTextarea').focus();
    });
    
    // Save functionality
    document.getElementById('saveTableBtn').onclick = () => {
        const lines = document.getElementById('tableEditTextarea').value.trim().split('\n').filter(line => line.trim());
        const newData = [];
        
        lines.forEach(line => {
            const parts = line.split('|').map(part => part.trim());
            if (field === 'risks' && parts.length >= 4) {
                newData.push({
                    description: parts[0],
                    dueBy: parts[1],
                    owner: parts[2],
                    ra: parts[3]
                });
            } else if (field === 'milestones' && parts.length >= 3) {
                newData.push({
                    milestone: parts[0],
                    forecastDate: parts[1],
                    status: parts[2]
                });
            }
        });
        
        // Save to state
        if (!state.generatedContent) state.generatedContent = {};
        state.generatedContent[field] = newData;
        save('generated-content', state.generatedContent);
        
        bootstrapModal.hide();
        updateUI();
        showToast('Table updated successfully!', 'success');
    };
    
    // Clean up modal when hidden
    modal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal);
    });
};

const init = async () => {
    $('config-btn').addEventListener('click', () => configureLLM(true));
    $('export-btn').addEventListener('click', exportToPPTX);
    $('update-form').addEventListener('submit', handleUpdateSubmit);
    $('modal-submit-btn').addEventListener('click', handleModalSubmit);
    $('page-title').addEventListener('click', resetToInitialState);
    updateUI();
    if (!state.llmConfig) await configureLLM(true);
};

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();