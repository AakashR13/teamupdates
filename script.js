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
        
        // Create a clone of the dashboard for export (without edit buttons)
        const exportContainer = document.createElement('div');
        exportContainer.style.position = 'fixed';
        exportContainer.style.top = '-9999px';
        exportContainer.style.left = '-9999px';
        exportContainer.style.width = '1200px';
        exportContainer.style.backgroundColor = 'white';
        exportContainer.style.padding = '20px';
        exportContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        exportContainer.style.fontSize = '14px';
        exportContainer.style.lineHeight = '1.5';
        exportContainer.style.color = '#333';
        exportContainer.innerHTML = dashboardContent.innerHTML;
        
        // Find and fix footer positioning for export
        const footerBar = exportContainer.querySelector('.footer-bar');
        if (footerBar) {
            // Convert fixed positioning to static for export
            footerBar.style.position = 'static';
            footerBar.style.marginTop = '30px';
            footerBar.style.width = '100%';
            footerBar.style.bottom = 'auto';
            footerBar.style.left = 'auto';
            footerBar.style.right = 'auto';
        }
        
        // Fix status update container for export - remove height constraint and scrolling
        const statusUpdateContainer = exportContainer.querySelector('.status-update-container');
        if (statusUpdateContainer) {
            statusUpdateContainer.style.height = 'auto';
            statusUpdateContainer.style.overflow = 'visible';
            statusUpdateContainer.style.maxHeight = 'none';
        }
        
        // Remove edit buttons from the clone
        const editButtons = exportContainer.querySelectorAll('button[title="Edit content"]');
        editButtons.forEach(btn => btn.remove());
        
        // Remove copy buttons from the clone
        const copyButtons = exportContainer.querySelectorAll('button[title="Copy content"]');
        copyButtons.forEach(btn => btn.remove());
        
        // Hide specific DOM elements from screenshot
        // Hide "Status Update" section (the old one with controls)
        const cardHeaders = exportContainer.querySelectorAll('.card-header h6');
        cardHeaders.forEach(header => {
            if (header.textContent.includes('Status Update:')) {
                header.closest('.card').style.display = 'none';
            }
        });
        
        // Add title to the export
        const title = document.createElement('h1');
        title.textContent = 'Team Updates Dashboard';
        title.style.textAlign = 'center';
        title.style.marginBottom = '30px';
        title.style.color = '#333';
        exportContainer.insertBefore(title, exportContainer.firstChild);
        
        document.body.appendChild(exportContainer);
        
        // Generate high-quality screenshot using SnapDOM - no size constraints
        const canvas = await snapdom.toCanvas(exportContainer, {
            backgroundColor: 'white',
            scale: 2,    // Higher scale for better quality
            embedFonts: true,
            quality: 1.0 // Maximum quality
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
        
        // Add slide with the screenshot
        const slide = pptx.addSlide();
        
        // Convert canvas to high-quality base64 PNG
        const imageData = canvas.toDataURL('image/png', 1.0); // Maximum quality
        
        // Add image to fill entire slide (16:9 ratio)
        slide.addImage({
            data: imageData,
            x: 0,
            y: 0,
            w: 10,
            h: 5.625, // 10 * (9/16) = 5.625 for 16:9 ratio
            sizing: {
                type: 'cover' // Fill entire area without shrinking
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