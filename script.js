import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1.2";
import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2";
import { html, render } from "https://cdn.jsdelivr.net/npm/lit-html@3.1.0/lit-html.js";

// State management
const state = {
    llmConfig: JSON.parse(localStorage.getItem('llm-config') || 'null'),
    updates: JSON.parse(localStorage.getItem('team-updates') || '[]')
};

// Utilities
const $ = id => document.getElementById(id);
const save = (key, data) => localStorage.setItem(key, JSON.stringify(data));
const showAlert = msg => {
    render(html`${msg}`, $('success-message'));
    $('success-alert').classList.remove('d-none');
    setTimeout(() => $('success-alert').classList.add('d-none'), 3000);
};

// UI Updates
const updateUI = () => {
    render(html`${state.updates.length}`, $('update-count'));
    $('generate-summary-btn').disabled = !state.updates.length || !state.llmConfig;
    
    const configBtn = $('config-btn');
    if (state.llmConfig) {
        configBtn.innerHTML = '<i class="bi bi-check-circle"></i> LLM Configured';
        configBtn.className = 'btn btn-success';
    } else {
        configBtn.innerHTML = '<i class="bi bi-gear"></i> Configure LLM';
        configBtn.className = 'btn btn-outline-primary';
    }
};

const setLoading = (elementId, isLoading) => {
    const element = $(elementId);
    if (elementId === 'update-form') {
        const submitBtn = element.querySelector('button[type="submit"]');
        submitBtn.disabled = isLoading;
        submitBtn.querySelector('.submit-text').textContent = isLoading ? 'Adding...' : 'Add Update';
        submitBtn.querySelector('.submit-spinner').classList.toggle('d-none', !isLoading);
    } else if (elementId === 'generate-summary-btn') {
        element.disabled = isLoading;
        element.querySelector('.summary-text').textContent = isLoading ? 'Generating...' : 'Generate Summary';
        element.querySelector('.summary-spinner').classList.toggle('d-none', !isLoading);
    } else {
        element.disabled = isLoading;
    }
};

const renderUpdates = () => {
    const updatesList = $('updates-list');
    
    if (!state.updates.length) {
        render(html`<div class="list-group-item text-muted text-center py-4">
            <i class="bi bi-inbox display-6 d-block mb-2"></i>No updates added yet</div>`, updatesList);
        return;
    }

    const updatesHtml = state.updates.map(({ id, teamName, timestamp, period, content }) => `
        <div class="list-group-item">
            <div class="d-flex justify-content-between align-items-start">
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h6 class="mb-0">${teamName}</h6>
                        <small class="text-muted">${new Date(timestamp).toLocaleDateString()}</small>
                    </div>
                    <span class="badge bg-secondary mb-2">${period}</span>
                    <p class="mb-0 small">${content.substring(0, 150)}${content.length > 150 ? '...' : ''}</p>
                </div>
                <button class="btn btn-sm btn-outline-danger ms-3" onclick="removeUpdate('${id}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
    `).join('');

    updatesList.innerHTML = updatesHtml;
};

// Event Handlers
const configureLLM = async (autoShow = false) => {
    setLoading('config-btn', true);
    
    state.llmConfig = await openaiConfig({
        title: "Configure AI Provider",
        help: autoShow ? '<div class="alert alert-info"><i class="bi bi-info-circle"></i> Please configure your AI provider to get started with summary generation</div>' : '',
        show: autoShow || !state.llmConfig,
        defaultBaseUrls: ["https://api.openai.com/v1", "https://api.anthropic.com/v1", "https://openrouter.ai/api/v1"],
        storage: localStorage,
        key: "llm-config",
        baseUrlLabel: "API Base URL",
        apiKeyLabel: "API Key",
        buttonLabel: "Save & Configure"
    });
    
    save('llm-config', state.llmConfig);
    showAlert('LLM configuration saved successfully');
    updateUI();
    setLoading('config-btn', false);
};

const handleUpdateSubmit = async e => {
    e.preventDefault();
    setLoading('update-form', true);
    
    const [teamName, period, content] = ['team-name', 'update-period', 'update-content'].map(id => $(id).value.trim());
    
    if (!teamName || !period || !content) {
        showAlert('Please fill in all required fields');
        setLoading('update-form', false);
        return;
    }
    
    state.updates.push({
        id: Date.now().toString(),
        teamName, period, content,
        timestamp: new Date().toISOString()
    });

    save('team-updates', state.updates);
    renderUpdates();
    updateUI();
    e.target.reset();
    
    showAlert('Update added successfully');
    setLoading('update-form', false);
};

const clearAllUpdates = () => {
    if (!state.updates.length || !confirm('Are you sure you want to clear all updates?')) return;
    
    state.updates = [];
    save('team-updates', state.updates);
    renderUpdates();
    updateUI();
    showAlert('All updates cleared');
    $('summary-content').classList.add('d-none');
};

const generateSummary = async () => {
    if (!state.llmConfig || !state.updates.length) return;

    setLoading('generate-summary-btn', true);
    
    const summaryContent = $('summary-content');
    render(html`<div class="text-muted"><i class="bi bi-three-dots"></i> Generating summary...</div>`, $('summary-text'));
    summaryContent.classList.remove('d-none');
    summaryContent.scrollIntoView({ behavior: 'smooth' });
    
    await streamLLMResponse();
    showAlert('Summary generated successfully');
    setLoading('generate-summary-btn', false);
};

const streamLLMResponse = async () => {
    let fullContent = '';
    let previousContent = '';
    const summaryElement = $('summary-text');

    const updatesText = state.updates.map(({ teamName, period, timestamp, content }) => 
        `**Team: ${teamName}** (${period})\nDate: ${new Date(timestamp).toLocaleDateString()}\n${content}\n\n`
    ).join('');

    const prompt = `You are an executive assistant preparing a leadership summary of team updates. 

Please analyze the following team updates and create a concise executive summary that includes:

1. **Key Highlights**: Most important achievements across all teams
2. **Cross-Team Themes**: Common patterns, challenges, or opportunities  
3. **Strategic Insights**: High-level observations for leadership consideration
4. **Action Items**: Recommended next steps or areas requiring leadership attention

Team Updates:
${updatesText}

Please format the response in clear sections with bullet points where appropriate. Keep it executive-level - focus on strategic insights rather than operational details. Use markdown formatting - Headings, bold, italic, lists, etc.`;

    const body = {
        model: 'gpt-5-mini',
        stream: true,
        messages: [{ role: 'user', content: prompt }]
    };

    for await (const { content } of asyncLLM(`${state.llmConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.llmConfig.apiKey}` },
        body: JSON.stringify(body)
    })) {
        if (content) {
            fullContent = content.includes(previousContent) && content.length > previousContent.length ? content : fullContent + content;
            previousContent = fullContent;
            summaryElement.innerHTML = marked.parse(fullContent);
        }
    }
};

const removeUpdate = id => {
    state.updates = state.updates.filter(update => update.id !== id);
    save('team-updates', state.updates);
    renderUpdates();
    updateUI();
    showAlert('Update removed');
};

// Initialize
const init = async () => {
    $('config-btn').addEventListener('click', () => configureLLM(true));
    $('update-form').addEventListener('submit', handleUpdateSubmit);
    $('clear-updates-btn').addEventListener('click', clearAllUpdates);
    $('generate-summary-btn').addEventListener('click', generateSummary);
    
    renderUpdates();
    updateUI();
    
    // Auto-show LLM config modal if not configured
    if (!state.llmConfig) {
        await configureLLM(true);
    }
};

// Global function for onclick handlers
globalThis.removeUpdate = removeUpdate;

// Auto-initialize when DOM is ready
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();