import { html } from "https://cdn.jsdelivr.net/npm/lit-html@3.1.0/lit-html.js";
import { unsafeHTML } from "https://cdn.jsdelivr.net/npm/lit-html@3.1.0/directives/unsafe-html.js";

export const card = (title, content, headerClass = 'bg-light') => html`
    <div class="card mb-3">
        <div class="card-header ${headerClass}"><h6 class="mb-0"><strong>${title}</strong></h6></div>
        <div class="card-body">${content}</div>
    </div>
`;

export const table = (headers, rows, emptyMsg) => html`
    <div class="table-responsive">
        <table class="table table-sm table-bordered">
            <thead class="table-primary"><tr>${headers.map(h => html`<th>${h}</th>`)}</tr></thead>
            <tbody>${rows.length ? rows : html`<tr><td class="text-muted" colspan="${headers.length}">${emptyMsg}</td></tr>`}</tbody>
        </table>
    </div>
`;

export const dashboardTemplate = (state, { clearAllUpdates, showInputForm, generateSummary, removeUpdate }) => html`
    <div class="row">
        <!-- Left Column -->
        <div class="col-lg-6">
            <!-- Portfolio Ownership -->
            <div class="card mb-3">
                <div class="card-header bg-light">
                    <h6 class="mb-0"><strong>Portfolio Ownership: EDAIS</strong></h6>
                </div>
            </div>

            <!-- Status Update Section -->
            <div class="card mb-3">
                <div class="card-header bg-light">
                    <h6 class="mb-0"><strong>Status Update:</strong></h6>
                </div>
                <div class="card-body">
                    <!-- Current Updates -->
                    <div class="border-bottom pb-3 mb-3">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6 class="mb-0 fw-bold">Current Updates <span class="badge bg-primary">${state.updates.length}</span></h6>
                            <div>
                                <button @click=${clearAllUpdates} class="btn btn-sm btn-outline-danger me-2">
                                    <i class="bi bi-trash"></i> Clear All
                                </button>
                                <button @click=${showInputForm} class="btn btn-sm btn-primary">
                                    <i class="bi bi-plus"></i> Add More
                                </button>
                            </div>
                        </div>
                        ${state.updates.length === 0 ? 
                            html`<div class="text-muted text-center py-3">
                                <i class="bi bi-inbox display-6 d-block mb-2"></i>No updates added yet
                            </div>` :
                            html`<div class="updates-container">
                                ${state.updates.map(update => html`
                                    <div class="border rounded p-3 mb-2 bg-white">
                                        <div class="d-flex justify-content-between align-items-start">
                                            <div class="flex-grow-1">
                                                <div class="d-flex justify-content-between align-items-center mb-2">
                                                    <h6 class="mb-0 fw-bold">${update.teamName}</h6>
                                                    <small class="text-muted">${new Date(update.timestamp).toLocaleDateString()}</small>
                                                </div>
                                                <span class="badge bg-secondary mb-2">${update.period}</span>
                                                <p class="mb-0 small">${update.content.substring(0, 150)}${update.content.length > 150 ? '...' : ''}</p>
                                            </div>
                                            <button @click=${() => removeUpdate(update.id)} class="btn btn-sm btn-outline-danger ms-3">
                                                <i class="bi bi-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                `)}
                            </div>`
                        }
                    </div>

                    <!-- Generate Button -->
                    <div class="text-center">
                        <button @click=${generateSummary} 
                                ?disabled=${!state.updates.length || !state.llmConfig || state.isGenerating}
                                class="btn btn-primary w-100">
                            ${state.isGenerating ? 
                                html`<span><i class="bi bi-three-dots"></i> Generating AI Summary...</span>` :
                                html`<span>Generate AI Summary</span>`
                            }
                        </button>
                    </div>
                </div>
            </div>

            <!-- Coming up/Next Steps Section -->
            <div class="card">
                <div class="card-header bg-light">
                    <h6 class="mb-0"><strong>Coming up/ Next Steps</strong></h6>
                </div>
                <div class="card-body">
                    <div class="next-steps-content">
                        ${state.generatedContent?.nextSteps ? unsafeHTML(marked.parse(state.generatedContent.nextSteps)) : 'Generate summary to see next steps'}
                    </div>
                </div>
            </div>
        </div>

        <!-- Right Column -->
        <div class="col-lg-6">
            <!-- AI Generated Summary -->
            <div class="card mb-3">
                <div class="card-header bg-light">
                    <h6 class="mb-0"><strong>Overall Summary/Path to Green/Additional Context:</strong></h6>
                </div>
                <div class="card-body">
                    <div class="summary-content">
                        ${state.generatedContent?.summary ? unsafeHTML(marked.parse(state.generatedContent.summary)) : 'Add team updates and generate summary to see content'}
                    </div>
                </div>
            </div>

            <!-- Key Risks/Issues/Dependencies -->
            <div class="card mb-3">
                <div class="card-header bg-light">
                    <h6 class="mb-0"><strong>Key Risks / Issues / Dependencies:</strong></h6>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-sm table-bordered">
                            <thead class="table-primary">
                                <tr>
                                    <th>Risk/Issue Description/Mitigation</th>
                                    <th>Due by</th>
                                    <th>Owner</th>
                                    <th>RA</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${state.generatedContent?.risks?.length ? 
                                    state.generatedContent.risks.map(risk => html`
                                        <tr>
                                            <td>${risk.description}</td>
                                            <td>${risk.dueBy}</td>
                                            <td>${risk.owner}</td>
                                            <td><span class="badge ${risk.ra === 'High' ? 'bg-danger' : risk.ra === 'Medium' ? 'bg-warning' : 'bg-success'}">${risk.ra}</span></td>
                                        </tr>
                                    `) :
                                    html`<tr><td class="text-muted" colspan="4">Generate summary to see key risks and dependencies</td></tr>`
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Core Milestone/Change Moments -->
            <div class="card">
                <div class="card-header bg-light">
                    <h6 class="mb-0"><strong>Core Milestone/Change Moments:</strong></h6>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-sm table-bordered">
                            <thead class="table-primary">
                                <tr>
                                    <th>Milestone</th>
                                    <th>Forecast Date</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${state.generatedContent?.milestones?.length ? 
                                    state.generatedContent.milestones.map(milestone => html`
                                        <tr>
                                            <td>${milestone.milestone}</td>
                                            <td>${milestone.forecastDate}</td>
                                            <td><span class="badge ${milestone.status === 'Complete' ? 'bg-success' : milestone.status === 'In progress' ? 'bg-primary' : milestone.status === 'On track' ? 'bg-success' : 'bg-warning'}">${milestone.status}</span></td>
                                        </tr>
                                    `) :
                                    html`<tr><td class="text-muted" colspan="3">Generate summary to see milestones</td></tr>`
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Bottom Section -->
    <div class="row mt-3">
        <div class="col-lg-6">
            <!-- PM/Workstream Lead -->
            <div class="card">
                <div class="card-header bg-light">
                    <h6 class="mb-0"><strong>PM/Workstream Lead:</strong></h6>
                </div>
                <div class="card-body">
                    <p><strong>Team:</strong> ${state.generatedContent?.pmTeam || 'To be generated'}</p>
                    <p class="mb-0"><strong>Sponsor:</strong> ${state.generatedContent?.sponsor || 'To be generated'}</p>
                </div>
            </div>
        </div>
        
        <div class="col-lg-6">
            <!-- Document Links -->
            <div class="card">
                <div class="card-header bg-light">
                    <h6 class="mb-0"><strong>Document Links</strong></h6>
                </div>
                <div class="card-body">
                    <ul class="list-unstyled mb-0">
                        <li>• Project Scope/Requirements</li>
                        <li>• Budget</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
`;
