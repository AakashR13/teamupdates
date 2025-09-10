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
const showAlert = msg => {
    render(html`${msg}`, $('success-message'));
    $('success-alert').classList.remove('d-none');
    setTimeout(() => $('success-alert').classList.add('d-none'), 3000);
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
    
    if (state.updates.length > 0) {
        $('last-update-date').textContent = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
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

const handleUpdateSubmit = async e => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const submitText = submitBtn.querySelector('.submit-text');
    const submitSpinner = submitBtn.querySelector('.submit-spinner');
    
    submitBtn.disabled = true;
    submitText.textContent = 'Adding...';
    submitSpinner.classList.remove('d-none');
    
    const [teamName, period, content] = ['team-name', 'update-period', 'update-content'].map(id => $(id).value.trim());
    
    if (!teamName || !period || !content) {
        showAlert('Please fill in all required fields');
        submitBtn.disabled = false;
        submitText.textContent = 'Add Update';
        submitSpinner.classList.add('d-none');
        return;
    }
    
    state.updates.push({ id: Date.now().toString(), teamName, period, content, timestamp: new Date().toISOString() });
    save('team-updates', state.updates);
    updateUI();
    e.target.reset();
    
    showAlert('Update added successfully');
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
    
    if (!teamName || !period || !content) {
        showAlert('Please fill in all required fields');
        submitBtn.disabled = false;
        submitText.textContent = 'Add Update';
        submitSpinner.classList.add('d-none');
        return;
    }
    
    state.updates.push({ id: Date.now().toString(), teamName, period, content, timestamp: new Date().toISOString() });
    save('team-updates', state.updates);
    updateUI();
    
    // Reset form and close modal
    ['modal-team-name', 'modal-update-period', 'modal-update-content'].forEach(id => $(id).value = '');
    bootstrap.Modal.getInstance($('addUpdateModal')).hide();
    
    showAlert('Update added successfully');
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

const init = async () => {
    $('config-btn').addEventListener('click', () => configureLLM(true));
    $('update-form').addEventListener('submit', handleUpdateSubmit);
    $('modal-submit-btn').addEventListener('click', handleModalSubmit);
    $('page-title').addEventListener('click', resetToInitialState);
    updateUI();
    if (!state.llmConfig) await configureLLM(true);
};

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();