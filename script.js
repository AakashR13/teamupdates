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
    prompts: {},
    showDashboard: false // New state variable to control dashboard visibility
};

console.log('Initial state loaded:', state); // Debug log

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
    console.log('updateUI called, state.showDashboard:', state.showDashboard, 'state.updates.length:', state.updates.length); // Debug log
    
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
    
    console.log('initialForm:', initialForm, 'dashboardContent:', dashboardContent); // Debug log
    
    // Check if we should show dashboard (only when explicitly requested via state.showDashboard)
    if (state.showDashboard && state.updates.length > 0) {
        console.log('Showing dashboard'); // Debug log
        initialForm.classList.add('d-none');
        dashboardContent.classList.remove('d-none');
        render(dashboardTemplate(state, { clearAllUpdates, showInputForm, generateSummary, removeUpdate }), dashboardContent);
    } else {
        console.log('Showing initial form'); // Debug log
        initialForm.classList.remove('d-none');
        dashboardContent.classList.add('d-none');
        
        // Update team count badge if on initial form
        updateTeamCountBadge();
        
        // Ensure buttons are properly initialized
        setTimeout(initializeButtons, 100); // Small delay to ensure DOM is ready
    }
};

const showInputForm = () => {
    if (state.showDashboard) {
        // Show modal for adding updates when in dashboard view
        const modal = new bootstrap.Modal($('addUpdateModal'));
        modal.show();
    } else {
        // Return to multi-team form
        state.showDashboard = false;
        updateUI();
    }
};

// Multi-team form management functions
let teamCounter = 1;

const updateTeamCountBadge = () => {
    const badge = $('team-count-badge');
    const container = $('team-updates-container');
    if (badge && container) {
        const teamForms = container.querySelectorAll('.team-update-form');
        const count = teamForms.length;
        badge.textContent = `${count} Team${count !== 1 ? 's' : ''}`;
    }
};

const addTeamForm = () => {
    console.log('addTeamForm function called'); // Debug log
    const container = $('team-updates-container');
    console.log('Container found:', container); // Debug log
    if (!container) return;
    
    teamCounter++;
    const teamIndex = teamCounter - 1;
    
    const teamFormHTML = `
        <div class="team-update-form border rounded p-3 mb-3" data-team-index="${teamIndex}">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h6 class="mb-0 fw-bold text-primary">Team Update #${teamCounter}</h6>
                <button type="button" class="btn btn-sm btn-outline-danger remove-team-btn">
                    <i class="bi bi-trash"></i> Remove
                </button>
            </div>
            
            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label fw-bold">Team Name</label>
                        <input type="text" class="form-control team-name" required 
                               placeholder="e.g., Engineering, Marketing, Sales">
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label fw-bold">Update Period</label>
                        <select class="form-select update-period" required>
                            <option value="">Select period...</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="mb-3">
                <label class="form-label fw-bold">Update Content</label>
                <textarea class="form-control update-content" rows="4" required
                          placeholder="Enter team accomplishments, challenges, and next steps..."></textarea>
                <div class="form-text">Include key achievements, blockers, and upcoming priorities</div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', teamFormHTML);
    updateTeamCountBadge();
    updateRemoveButtonsVisibility();
    
    // Scroll to the new form
    const newForm = container.lastElementChild;
    newForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Focus on the team name input
    const teamNameInput = newForm.querySelector('.team-name');
    if (teamNameInput) {
        setTimeout(() => teamNameInput.focus(), 300);
    }
};

const removeTeamForm = (teamForm) => {
    if (!teamForm) return;
    
    const container = $('team-updates-container');
    const teamForms = container.querySelectorAll('.team-update-form');
    
    // Don't allow removing if it's the last team
    if (teamForms.length <= 1) {
        showToast('At least one team update is required', 'warning');
        return;
    }
    
    teamForm.remove();
    updateTeamCountBadge();
    updateRemoveButtonsVisibility();
    renumberTeamForms();
};

const updateRemoveButtonsVisibility = () => {
    const container = $('team-updates-container');
    const teamForms = container.querySelectorAll('.team-update-form');
    const removeButtons = container.querySelectorAll('.remove-team-btn');
    
    // Show remove buttons only if there's more than one team
    removeButtons.forEach(btn => {
        if (teamForms.length > 1) {
            btn.classList.remove('d-none');
        } else {
            btn.classList.add('d-none');
        }
    });
};

const renumberTeamForms = () => {
    const container = $('team-updates-container');
    const teamForms = container.querySelectorAll('.team-update-form');
    
    teamForms.forEach((form, index) => {
        const header = form.querySelector('h6');
        if (header) {
            header.textContent = `Team Update #${index + 1}`;
        }
        form.setAttribute('data-team-index', index);
    });
    
    teamCounter = teamForms.length;
};

const validateAllTeamForms = () => {
    const container = $('team-updates-container');
    const teamForms = container.querySelectorAll('.team-update-form');
    const errors = [];
    
    teamForms.forEach((form, index) => {
        const teamName = form.querySelector('.team-name').value.trim();
        const period = form.querySelector('.update-period').value;
        const content = form.querySelector('.update-content').value.trim();
        
        if (!teamName) {
            errors.push(`Team #${index + 1}: Team name is required`);
        }
        if (!period) {
            errors.push(`Team #${index + 1}: Update period is required`);
        }
        if (!content) {
            errors.push(`Team #${index + 1}: Update content is required`);
        }
    });
    
    return errors;
};

const processAllTeamUpdates = async () => {
    const validationErrors = validateAllTeamForms();
    
    if (validationErrors.length > 0) {
        showToast(validationErrors[0], 'danger'); // Show first error
        return false;
    }
    
    const container = $('team-updates-container');
    const teamForms = container.querySelectorAll('.team-update-form');
    
    // Clear existing updates
    state.updates = [];
    
    // Add all team updates
    teamForms.forEach(form => {
        const teamName = form.querySelector('.team-name').value.trim();
        const period = form.querySelector('.update-period').value;
        const content = form.querySelector('.update-content').value.trim();
        
        state.updates.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            teamName,
            period,
            content,
            timestamp: new Date().toISOString()
        });
    });
    
    // Save updates
    save('team-updates', state.updates);
    
    // Switch to dashboard view
    state.showDashboard = true;
    updateUI();
    
    // Auto-generate AI summary if LLM is configured
    if (state.llmConfig && !state.isGenerating) {
        setTimeout(() => {
            generateSummary();
        }, 500);
    }
    
    showToast(`Successfully added ${state.updates.length} team updates!`, 'success');
    return true;
};

const configureLLM = async (autoShow = false) => {
    const configBtn = $('config-btn');
    if (configBtn) {
        configBtn.disabled = true;
    }
    
    // Create a simplified configuration modal for API settings only
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'llmConfigModal';
    modal.tabIndex = -1;
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Configure AI Provider</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    ${autoShow ? '<div class="alert alert-info"><i class="bi bi-info-circle"></i> Please configure your AI provider to get started</div>' : ''}
                    
                    <div class="mb-3">
                        <label for="apiBaseUrl" class="form-label fw-bold">API Base URL</label>
                        <select class="form-select mb-2" id="baseUrlSelect">
                            <option value="">Select a provider...</option>
                            <option value="https://api.openai.com/v1">OpenAI</option>
                            <option value="https://api.anthropic.com/v1">Anthropic</option>
                            <option value="https://openrouter.ai/api/v1">OpenRouter</option>
                            <option value="custom">Custom URL</option>
                        </select>
                        <input type="url" class="form-control" id="apiBaseUrl" placeholder="Enter API base URL" 
                               value="${state.llmConfig?.baseUrl || ''}" required>
                    </div>
                    
                    <div class="mb-3">
                        <label for="apiKey" class="form-label fw-bold">API Key</label>
                        <input type="password" class="form-control" id="apiKey" placeholder="Enter your API key" 
                               value="${state.llmConfig?.apiKey || ''}" required>
                        <div class="form-text">Your API key is stored locally and never sent to any external servers except the AI provider you specify.</div>
                    </div>
                    
                    <div class="alert alert-light">
                        <i class="bi bi-lightbulb"></i> 
                        <strong>Tip:</strong> Use the separate "Edit Prompt" button to customize how the AI generates summaries from your team updates.
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="saveLLMConfig">Save Configuration</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
    
    // Handle base URL selection
    document.getElementById('baseUrlSelect').addEventListener('change', (e) => {
        const apiBaseUrlInput = document.getElementById('apiBaseUrl');
        if (e.target.value && e.target.value !== 'custom') {
            apiBaseUrlInput.value = e.target.value;
        }
        if (e.target.value === 'custom') {
            apiBaseUrlInput.focus();
        }
    });
    
    // Set initial base URL selection
    const baseUrlSelect = document.getElementById('baseUrlSelect');
    const currentBaseUrl = state.llmConfig?.baseUrl || '';
    const predefinedUrls = ['https://api.openai.com/v1', 'https://api.anthropic.com/v1', 'https://openrouter.ai/api/v1'];
    if (predefinedUrls.includes(currentBaseUrl)) {
        baseUrlSelect.value = currentBaseUrl;
    } else if (currentBaseUrl) {
        baseUrlSelect.value = 'custom';
    }
    
    // Save functionality
    document.getElementById('saveLLMConfig').onclick = () => {
        const baseUrl = document.getElementById('apiBaseUrl').value.trim();
        const apiKey = document.getElementById('apiKey').value.trim();
        
        if (!baseUrl || !apiKey) {
            showToast('Please fill in all required fields', 'danger');
            return;
        }
        
        // Preserve existing prompt if available, otherwise use default
        const existingPrompt = state.llmConfig?.summaryPrompt || state.prompts.summaryGeneration || '';
        
        // Save configuration
        state.llmConfig = {
            baseUrl,
            apiKey,
            summaryPrompt: existingPrompt
        };
        
        save('llm-config', state.llmConfig);
        bootstrapModal.hide();
        showAlert('LLM configuration saved successfully');
        updateUI();
    };
    
    // Clean up modal when hidden - handle both close methods
    modal.addEventListener('hidden.bs.modal', () => {
        try {
            document.body.removeChild(modal);
        } catch (e) {
            // Modal already removed
        }
        if (configBtn) configBtn.disabled = false;
    });
    
    // Also handle modal disposal
    modal.addEventListener('hide.bs.modal', () => {
        if (configBtn) configBtn.disabled = false;
    });
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

// handleUpdateSubmit function removed - now using multi-team processing

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

    // Use the custom prompt from config, or load default if not available
    let summaryPrompt = state.llmConfig?.summaryPrompt;
    if (!summaryPrompt) {
        if (!state.prompts.summaryGeneration) {
            state.prompts.summaryGeneration = await loadText('./prompts/summary-generation.md');
        }
        summaryPrompt = state.prompts.summaryGeneration;
    }

    const updatesText = state.updates.map(({ teamName, period, timestamp, content }) => 
        `**Team: ${teamName}** (${period})\nDate: ${new Date(timestamp).toLocaleDateString()}\n${content}\n\n`).join('');

    const prompt = summaryPrompt.replace('{{UPDATES_CONTENT}}', updatesText);

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
        
        // Reset state
        state.updates = [];
        state.generatedContent = null;
        state.showDashboard = false;
        
        // Reset multi-team form
        const container = $('team-updates-container');
        if (container) {
            // Remove all team forms
            container.innerHTML = '';
            
            // Add back the initial team form
            const initialTeamFormHTML = `
                <div class="team-update-form border rounded p-3 mb-3" data-team-index="0">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h6 class="mb-0 fw-bold text-primary">Team Update #1</h6>
                        <button type="button" class="btn btn-sm btn-outline-danger remove-team-btn d-none">
                            <i class="bi bi-trash"></i> Remove
                        </button>
                    </div>
                    
                    <div class="row">
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label class="form-label fw-bold">Team Name</label>
                                <input type="text" class="form-control team-name" required 
                                       placeholder="e.g., Engineering, Marketing, Sales">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label class="form-label fw-bold">Update Period</label>
                                <select class="form-select update-period" required>
                                    <option value="">Select period...</option>
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="quarterly">Quarterly</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label fw-bold">Update Content</label>
                        <textarea class="form-control update-content" rows="4" required
                                  placeholder="Enter team accomplishments, challenges, and next steps..."></textarea>
                        <div class="form-text">Include key achievements, blockers, and upcoming priorities</div>
                    </div>
                </div>
            `;
            
            container.innerHTML = initialTeamFormHTML;
            teamCounter = 1;
        }
        
        updateUI();
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
        
        // Remove any existing footer from the main content to prevent duplication
        const existingFooter = mainContent.querySelector('.footer-bar');
        if (existingFooter) {
            existingFooter.remove();
        }
        
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
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div class="form-text">You can use Markdown formatting (e.g., **bold**, *italic*, - lists)</div>
                        <div class="btn-group">
                            <button type="button" class="btn btn-outline-success btn-sm" id="expandBtn" ${!state.llmConfig ? 'disabled' : ''}>
                                <i class="bi bi-arrows-expand"></i> Expand
                            </button>
                            <button type="button" class="btn btn-outline-secondary btn-sm" id="shortenBtn" ${!state.llmConfig ? 'disabled' : ''}>
                                <i class="bi bi-scissors"></i> Shorten
                            </button>
                        </div>
                    </div>
                    <textarea class="form-control" id="editTextarea" rows="8" placeholder="Enter content (Markdown supported)...">${currentValue}</textarea>
                    <div class="mt-2">
                        <small class="text-muted">Word count: <span id="wordCount">0</span></small>
                        ${!state.llmConfig ? '<div class="text-warning small mt-1"><i class="bi bi-exclamation-triangle"></i> Configure LLM to enable expand/shorten features</div>' : ''}
                    </div>
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
        const textarea = document.getElementById('editTextarea');
        textarea.focus();
        updateWordCount();
    });
    
    // Word count functionality
    const updateWordCount = () => {
        const textarea = document.getElementById('editTextarea');
        const wordCountSpan = document.getElementById('wordCount');
        if (textarea && wordCountSpan) {
            const text = textarea.value.trim();
            const wordCount = text ? text.split(/\s+/).length : 0;
            wordCountSpan.textContent = wordCount;
        }
    };
    
    // Add word count listener
    document.getElementById('editTextarea').addEventListener('input', updateWordCount);
    
    // Expand functionality
    const expandBtn = document.getElementById('expandBtn');
    if (expandBtn && state.llmConfig) {
        expandBtn.onclick = async () => {
            const textarea = document.getElementById('editTextarea');
            const currentText = textarea.value.trim();
            
            if (!currentText) {
                showToast('No content to expand', 'warning');
                return;
            }
            
            // Show loading state
            expandBtn.disabled = true;
            expandBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Expanding...';
            
            try {
                // Load the original prompt if not already loaded
                if (!state.prompts.summaryGeneration) {
                    state.prompts.summaryGeneration = await loadText('./prompts/summary-generation.md');
                }
                
                // Get the original team updates for context
                const updatesText = state.updates.map(({ teamName, period, timestamp, content }) => 
                    `**Team: ${teamName}** (${period})\nDate: ${new Date(timestamp).toLocaleDateString()}\n${content}\n\n`).join('');
                
                // Calculate current word count and target expansion
                const currentWordCount = currentText.trim().split(/\s+/).length;
                const targetWordCount = Math.round(currentWordCount * 1.25); // 25% increase
                const minWordCount = Math.round(currentWordCount * 1.15); // At least 15% increase
                const maxWordCount = Math.round(currentWordCount * 1.4); // Max 40% increase
                
                const prompt = `Based on the following team updates and the current ${field} content, please expand and provide more detailed information while maintaining the same format and style:

TEAM UPDATES:
${updatesText}

CURRENT ${field.toUpperCase()} CONTENT:
${currentText}

INSTRUCTIONS:
Please expand the current content with more specific details, examples, and context from the team updates. 

WORD COUNT REQUIREMENTS:
- Current word count: ${currentWordCount} words
- Target word count: ${targetWordCount} words (aim for this)
- Minimum word count: ${minWordCount} words
- Maximum word count: ${maxWordCount} words

Keep the expansion focused and valuable for stakeholders while maintaining the same structure and format. Do not completely rewrite the content, just enhance it with additional relevant details and context from the team updates provided above.`;

                // Use non-streaming API call
                const response = await fetch(`${state.llmConfig.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'Authorization': `Bearer ${state.llmConfig.apiKey}` 
                    },
                    body: JSON.stringify({ 
                        model: 'gpt-4o', 
                        stream: false,
                        messages: [{ role: 'user', content: prompt }]
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                const expandedContent = data.choices[0]?.message?.content || '';
                
                if (expandedContent) {
                    textarea.value = expandedContent;
                    updateWordCount();
                    
                    // Calculate the actual expansion achieved
                    const newWordCount = expandedContent.trim().split(/\s+/).length;
                    const expansionPercentage = Math.round(((newWordCount - currentWordCount) / currentWordCount) * 100);
                    
                    console.log(`Expansion: ${currentWordCount} → ${newWordCount} words (+${expansionPercentage}%)`);
                    showToast(`Content expanded successfully! ${currentWordCount} → ${newWordCount} words (+${expansionPercentage}%)`, 'success');
                } else {
                    throw new Error('No content received from API');
                }
                
            } catch (error) {
                console.error('Error expanding content:', error);
                showToast('Failed to expand content. Please try again.', 'danger');
            } finally {
                // Restore button state
                expandBtn.disabled = false;
                expandBtn.innerHTML = '<i class="bi bi-arrows-expand"></i> Expand';
            }
        };
    }

    // Shorten/Summarize functionality
    const shortenBtn = document.getElementById('shortenBtn');
    if (shortenBtn && state.llmConfig) {
        shortenBtn.onclick = async () => {
            const textarea = document.getElementById('editTextarea');
            const currentText = textarea.value.trim();
            
            if (!currentText) {
                showToast('No content to shorten', 'warning');
                return;
            }
            
            // Show loading state
            shortenBtn.disabled = true;
            shortenBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Shortening...';
            
            try {
                // Calculate current word count and target reduction
                const currentWordCount = currentText.trim().split(/\s+/).length;
                const targetWordCount = Math.round(currentWordCount * 0.65); // 35% reduction (65% of original)
                const minWordCount = Math.round(currentWordCount * 0.5); // Max 50% reduction
                const maxWordCount = Math.round(currentWordCount * 0.8); // Min 20% reduction
                
                const prompt = `Please shorten and summarize the following content while preserving the key information and maintaining the same format/style:

${currentText}

WORD COUNT REQUIREMENTS:
- Current word count: ${currentWordCount} words
- Target word count: ${targetWordCount} words (aim for this)
- Minimum word count: ${minWordCount} words (don't go below this)
- Maximum word count: ${maxWordCount} words (don't exceed this)

Please provide a shortened version that maintains the essential points while being more concise and focused.`;

                // Use non-streaming API call to avoid content duplication issues
                const response = await fetch(`${state.llmConfig.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'Authorization': `Bearer ${state.llmConfig.apiKey}` 
                    },
                    body: JSON.stringify({ 
                        model: 'gpt-4o', 
                        stream: false, // Non-streaming to get complete response
                        messages: [{ role: 'user', content: prompt }]
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                const shortenedContent = data.choices[0]?.message?.content || '';
                
                if (shortenedContent) {
                    textarea.value = shortenedContent;
                    updateWordCount();
                    
                    // Calculate the actual reduction achieved
                    const newWordCount = shortenedContent.trim().split(/\s+/).length;
                    const reductionPercentage = Math.round(((currentWordCount - newWordCount) / currentWordCount) * 100);
                    
                    console.log(`Shortening: ${currentWordCount} → ${newWordCount} words (-${reductionPercentage}%)`);
                    showToast(`Content shortened successfully! ${currentWordCount} → ${newWordCount} words (-${reductionPercentage}%)`, 'success');
                } else {
                    throw new Error('No content received from API');
                }
                
            } catch (error) {
                console.error('Error shortening content:', error);
                showToast('Failed to shorten content. Please try again.', 'danger');
            } finally {
                // Restore button state
                shortenBtn.disabled = false;
                shortenBtn.innerHTML = '<i class="bi bi-scissors"></i> Shorten';
            }
        };
    }
    
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

// Edit Prompt functionality - Separate modal for prompt editing  
const editPrompt = async () => {
    const editPromptBtn = $('edit-prompt-btn');
    if (editPromptBtn) {
        editPromptBtn.disabled = true;
    }
    
    // Get current prompt - use saved one or default
    let currentPrompt = state.llmConfig?.summaryPrompt || state.prompts.summaryGeneration || '';
    
    // Create dedicated prompt editing modal
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'promptEditModal';
    modal.tabIndex = -1;
    modal.innerHTML = `
        <div class="modal-dialog modal-xl">
            <div class="modal-content">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title">
                        <i class="bi bi-pencil-square me-2"></i>Edit AI Summary Generation Prompt
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-info">
                        <i class="bi bi-info-circle"></i> 
                        <strong>Instructions:</strong> Customize how the AI generates summaries from your team updates. 
                        Use <code>{{UPDATES_CONTENT}}</code> as a placeholder where team updates will be inserted.
                    </div>
                    
                    <div class="mb-3">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <div class="btn-group">
                                <button type="button" class="btn btn-outline-secondary btn-sm" id="resetPromptBtn">
                                    <i class="bi bi-arrow-clockwise"></i> Reset to Default
                                </button>
                                <button type="button" class="btn btn-outline-info btn-sm" id="previewPromptBtn">
                                    <i class="bi bi-eye"></i> Preview
                                </button>
                            </div>
                            <div class="text-end">
                                <small class="text-muted">Characters: <span id="promptCharCount" class="fw-bold">0</span></small><br>
                                <small class="text-muted">Lines: <span id="promptLineCount" class="fw-bold">0</span></small>
                            </div>
                        </div>
                        
                        <textarea class="form-control" id="promptEditor" rows="20" 
                                  style="font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.4;"
                                  placeholder="Enter your custom prompt here...">${currentPrompt}</textarea>
                        
                        <div class="mt-2">
                            <small class="text-muted">
                                <i class="bi bi-lightbulb"></i> 
                                <strong>Tip:</strong> Your prompt should include instructions for generating JSON with fields like 
                                "summary", "nextSteps", "risks", "milestones", etc.
                            </small>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-success" id="savePromptBtn">
                        <i class="bi bi-check-circle"></i> Save Prompt
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
    
    // Update character and line count
    const updateCounts = () => {
        const textarea = document.getElementById('promptEditor');
        const charCountSpan = document.getElementById('promptCharCount');
        const lineCountSpan = document.getElementById('promptLineCount');
        if (textarea && charCountSpan && lineCountSpan) {
            charCountSpan.textContent = textarea.value.length;
            lineCountSpan.textContent = textarea.value.split('\n').length;
        }
    };
    
    // Add listeners
    document.getElementById('promptEditor').addEventListener('input', updateCounts);
    updateCounts(); // Initial count
    
    // Reset to default functionality
    document.getElementById('resetPromptBtn').onclick = () => {
        if (confirm('Are you sure you want to reset the prompt to the default version? This will overwrite your current changes.')) {
            document.getElementById('promptEditor').value = state.prompts.summaryGeneration || '';
            updateCounts();
            showToast('Prompt reset to default', 'info');
        }
    };
    
    // Preview functionality
    document.getElementById('previewPromptBtn').onclick = () => {
        const promptText = document.getElementById('promptEditor').value;
        if (!promptText.trim()) {
            showToast('No prompt content to preview', 'warning');
            return;
        }
        
        // Create preview modal
        const previewModal = document.createElement('div');
        previewModal.className = 'modal fade';
        previewModal.id = 'promptPreviewModal';
        previewModal.tabIndex = -1;
        previewModal.innerHTML = `
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="bi bi-eye me-2"></i>Prompt Preview
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info">
                            <i class="bi bi-info-circle"></i> This is how your prompt will appear when sent to the AI model.
                        </div>
                        <pre style="background-color: #f8f9fa; padding: 1.5rem; border-radius: 0.5rem; white-space: pre-wrap; font-size: 13px; max-height: 600px; overflow-y: auto; border: 1px solid #dee2e6;">${promptText}</pre>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(previewModal);
        const previewBootstrapModal = new bootstrap.Modal(previewModal);
        previewBootstrapModal.show();
        
        // Clean up preview modal when hidden
        previewModal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(previewModal);
        });
    };
    

    
    // Save functionality
    document.getElementById('savePromptBtn').onclick = () => {
        const promptText = document.getElementById('promptEditor').value.trim();
        
        if (!promptText) {
            showToast('Please provide a prompt before saving', 'warning');
            return;
        }
        
        if (!promptText.includes('{{UPDATES_CONTENT}}')) {
            if (!confirm('Your prompt doesn\'t include {{UPDATES_CONTENT}} placeholder. This means team updates won\'t be included in the AI request. Continue anyway?')) {
                return;
            }
        }
        
        // Save to current session (will be saved to localStorage when LLM config is saved)
        if (!state.llmConfig) {
            state.llmConfig = {};
        }
        state.llmConfig.summaryPrompt = promptText;
        save('llm-config', state.llmConfig);
        
        bootstrapModal.hide();
        showToast('Prompt saved successfully! It will be used for future AI summaries.', 'success');
        updateUI();
    };
    
    // Clean up modal when hidden - handle both close methods
    modal.addEventListener('hidden.bs.modal', () => {
        try {
            document.body.removeChild(modal);
        } catch (e) {
            // Modal already removed
        }
        if (editPromptBtn) editPromptBtn.disabled = false;
    });
    
    // Also handle modal disposal
    modal.addEventListener('hide.bs.modal', () => {
        if (editPromptBtn) editPromptBtn.disabled = false;
    });
};

const init = async () => {
    // Load default prompt at startup
    try {
        state.prompts.summaryGeneration = await loadText('./prompts/summary-generation.md');
    } catch (error) {
        console.error('Failed to load default prompt:', error);
        showToast('Failed to load default prompt. Please check the file.', 'warning');
    }
    
    // Add error handling for button event listeners
    try {
        const configBtn = $('config-btn');
        if (configBtn) {
            configBtn.addEventListener('click', () => {
                try {
                    configureLLM(false);
                } catch (error) {
                    console.error('Error in configureLLM:', error);
                    showToast('Error opening configuration modal', 'danger');
                }
            });
        }
    } catch (error) {
        console.error('Error setting up config button:', error);
    }
    
    try {
        const editPromptBtn = $('edit-prompt-btn');
        if (editPromptBtn) {
            editPromptBtn.addEventListener('click', () => {
                try {
                    editPrompt();
                } catch (error) {
                    console.error('Error in editPrompt:', error);
                    showToast('Error opening prompt editor', 'danger');
                }
            });
        }
    } catch (error) {
        console.error('Error setting up edit prompt button:', error);
    }
    
    try {
        const exportBtn = $('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportToPPTX);
        }
    } catch (error) {
        console.error('Error setting up export button:', error);
    }
    
    // Multi-team form event listeners - using robust initialization
    try {
        // Initialize buttons after a short delay to ensure DOM is ready
        setTimeout(initializeButtons, 200);
    } catch (error) {
        console.error('Error setting up buttons:', error);
    }
    
    // Generate dashboard button setup moved to initializeButtons function
    
    // Event delegation for remove team buttons
    try {
        const container = $('team-updates-container');
        if (container) {
            container.addEventListener('click', (e) => {
                if (e.target.closest('.remove-team-btn')) {
                    const teamForm = e.target.closest('.team-update-form');
                    removeTeamForm(teamForm);
                }
            });
        }
    } catch (error) {
        console.error('Error setting up team removal functionality:', error);
    }
    
    try {
        const modalSubmitBtn = $('modal-submit-btn');
        if (modalSubmitBtn) {
            modalSubmitBtn.addEventListener('click', handleModalSubmit);
        }
    } catch (error) {
        console.error('Error setting up modal submit button:', error);
    }
    
    try {
        const pageTitle = $('page-title');
        if (pageTitle) {
            pageTitle.addEventListener('click', resetToInitialState);
        }
    } catch (error) {
        console.error('Error setting up page title:', error);
    }
    
    try {
        updateUI();
    } catch (error) {
        console.error('Error updating UI:', error);
    }
    
    try {
        if (!state.llmConfig) {
            await configureLLM(true);
        }
    } catch (error) {
        console.error('Error in initial LLM configuration:', error);
    }
};

// Complete reset function for debugging
const completeReset = () => {
    localStorage.clear();
    state.updates = [];
    state.generatedContent = null;
    state.showDashboard = false;
    state.isGenerating = false;
    
    // Reset form
    const container = $('team-updates-container');
    if (container) {
        container.innerHTML = `
            <div class="team-update-form border rounded p-3 mb-3" data-team-index="0">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="mb-0 fw-bold text-primary">Team Update #1</h6>
                    <button type="button" class="btn btn-sm btn-outline-danger remove-team-btn d-none">
                        <i class="bi bi-trash"></i> Remove
                    </button>
                </div>
                
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label class="form-label fw-bold">Team Name</label>
                            <input type="text" class="form-control team-name" required 
                                   placeholder="e.g., Engineering, Marketing, Sales">
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label class="form-label fw-bold">Update Period</label>
                            <select class="form-select update-period" required>
                                <option value="">Select period...</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="quarterly">Quarterly</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="mb-3">
                    <label class="form-label fw-bold">Update Content</label>
                    <textarea class="form-control update-content" rows="4" required
                              placeholder="Enter team accomplishments, challenges, and next steps..."></textarea>
                    <div class="form-text">Include key achievements, blockers, and upcoming priorities</div>
                </div>
            </div>
        `;
    }
    
    teamCounter = 1;
    updateUI();
};

// Make it available globally for debugging
window.completeReset = completeReset;

// Robust button initialization with retry mechanism
const initializeButtons = () => {
    console.log('Initializing buttons...');
    
    // Initialize add team button
    const addTeamBtn = $('add-team-btn');
    if (addTeamBtn) {
        console.log('Add team button found, attaching listener');
        addTeamBtn.onclick = () => {
            console.log('Add team button clicked');
            addTeamForm();
        };
    } else {
        console.error('Add team button not found');
    }
    
    // Initialize generate dashboard button
    const generateDashboardBtn = $('generate-dashboard-btn');
    if (generateDashboardBtn) {
        console.log('Generate dashboard button found, attaching listener');
        generateDashboardBtn.onclick = async () => {
            console.log('Generate dashboard button clicked');
            const btn = generateDashboardBtn;
            const btnText = btn.querySelector('.generate-text');
            const btnSpinner = btn.querySelector('.generate-spinner');
            
            try {
                btn.disabled = true;
                if (btnText) btnText.textContent = 'Processing...';
                if (btnSpinner) btnSpinner.classList.remove('d-none');
                
                await processAllTeamUpdates();
            } catch (error) {
                console.error('Error processing team updates:', error);
                showToast('Error processing team updates', 'danger');
            } finally {
                btn.disabled = false;
                if (btnText) btnText.textContent = 'Generate Dashboard';
                if (btnSpinner) btnSpinner.classList.add('d-none');
            }
        };
    } else {
        console.error('Generate dashboard button not found');
    }
};

// Make debugging functions available globally
window.completeReset = completeReset;
window.initializeButtons = initializeButtons;
window.addTeamForm = addTeamForm;
window.processAllTeamUpdates = processAllTeamUpdates;

// Simple test function
window.testButtons = () => {
    console.log('Testing buttons...');
    const addBtn = $('add-team-btn');
    const genBtn = $('generate-dashboard-btn');
    console.log('Add button:', addBtn);
    console.log('Generate button:', genBtn);
    console.log('Add button onclick:', addBtn?.onclick);
    console.log('Generate button onclick:', genBtn?.onclick);
};

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();