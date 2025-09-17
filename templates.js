import { html } from "https://cdn.jsdelivr.net/npm/lit-html@3.1.0/lit-html.js";
import { unsafeHTML } from "https://cdn.jsdelivr.net/npm/lit-html@3.1.0/directives/unsafe-html.js";

export const card = (title, content, headerClass = 'bg-light', copyId = null) => html`
    <div class="card mb-3">
        <div class="card-header ${headerClass}">
            <div class="d-flex justify-content-between align-items-center">
                <h6 class="mb-0"><strong>${title}</strong></h6>
                ${copyId ? html`<button class="btn btn-sm btn-outline-secondary" @click=${() => window.copyContent(copyId)} title="Copy content">
                    <i class="bi bi-clipboard"></i>
                </button>` : ''}
            </div>
        </div>
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
            <!-- Status Update Section -->
            <div class="card mb-3">
                <div class="card-header bg-primary text-white">
                    <h6 class="mb-0"><strong>Status Update</strong></h6>
                    <small>Overall Summary / Path to Green / Additional Context</small>
                </div>
                <div class="card-body">
                    <!-- Achieved Section -->
                    <div class="mb-4">
                        <h6 class="fw-bold mb-3">Achieved</h6>
                        <div id="achieved-content">
                            ${state.generatedContent?.summary ? unsafeHTML(marked.parse(state.generatedContent.summary)) : 
                                html`<div class="text-center py-3">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                    <p class="text-muted mt-2 mb-0">Generating content...</p>
                                </div>`
                            }
                        </div>
                    </div>

                    <!-- Coming Up / Next Steps Section -->
                    <div>
                        <h6 class="fw-bold mb-3">Coming Up / Next Steps</h6>
                        <div id="next-steps" class="next-steps-content">
                            ${state.generatedContent?.nextSteps ? unsafeHTML(marked.parse(state.generatedContent.nextSteps)) : 
                                html`<div class="text-center py-3">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                    <p class="text-muted mt-2 mb-0">Generating content...</p>
                                </div>`
                            }
                        </div>
                    </div>

                    <!-- Hidden controls for functionality -->
                    <div class="d-none">
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
            </div>
        </div>

        <!-- Right Column -->
        <div class="col-lg-6">
            <!-- Key Risks/Issues/Dependencies -->
            <div class="card mb-3">
                <div class="card-header bg-primary text-white">
                    <h6 class="mb-0"><strong>Key Risks / Issues / Dependencies</strong></h6>
                </div>
                <div class="card-body">
                    <div id="risks" class="table-responsive">
                        <table class="table table-sm table-bordered">
                            <thead class="table-primary">
                                <tr>
                                    <th>Risk / Issue Description & Mitigation</th>
                                    <th>Due by</th>
                                    <th>Owner</th>
                                    <th>RGA</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${state.generatedContent?.risks?.length ? 
                                    state.generatedContent.risks.map(risk => html`
                                        <tr>
                                            <td>${risk.description}</td>
                                            <td>${risk.dueBy}</td>
                                            <td>${risk.owner}</td>
                                            <td><span class="status-dot ${risk.ra === 'High' ? 'red' : risk.ra === 'Medium' ? 'yellow' : 'green'}"></span> ${risk.ra}</td>
                                        </tr>
                                    `) :
                                    html`<tr><td class="text-center py-3" colspan="4">
                                        <div class="spinner-border spinner-border-sm text-primary" role="status">
                                            <span class="visually-hidden">Loading...</span>
                                        </div>
                                        <span class="text-muted ms-2">Generating risks...</span>
                                    </td></tr>`
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Core Milestone/Change Moments -->
            <div class="card mb-3">
                <div class="card-header bg-primary text-white">
                    <h6 class="mb-0"><strong>Core Milestone / Change Moments</strong></h6>
                </div>
                <div class="card-body">
                    <div id="milestones" class="table-responsive">
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
                                            <td><span class="status-dot ${milestone.status === 'Complete' ? 'green' : milestone.status === 'In progress' ? 'blue' : milestone.status === 'On track' ? 'green' : 'yellow'}"></span> ${milestone.status}</td>
                                        </tr>
                                    `) :
                                    html`<tr><td class="text-center py-3" colspan="3">
                                        <div class="spinner-border spinner-border-sm text-primary" role="status">
                                            <span class="visually-hidden">Loading...</span>
                                        </div>
                                        <span class="text-muted ms-2">Generating milestones...</span>
                                    </td></tr>`
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Footer Cards in Right Column -->
            <div class="row mt-3">
                <div class="col-6">
                    <div class="card mb-3 h-100">
                        <div class="card-body text-center d-flex flex-column justify-content-center" style="min-height: 120px;">
                            <h6 class="fw-bold">PM/Workstream Lead</h6>
                            <p class="mb-0 small">${state.generatedContent?.pmTeam || 
                                html`<div class="spinner-border spinner-border-sm text-primary" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>`
                            }</p>
                        </div>
                    </div>
                </div>
                <div class="col-6">
                    <div class="card mb-3 h-100">
                        <div class="card-body text-center d-flex flex-column justify-content-center" style="min-height: 120px;">
                            <h6 class="fw-bold">Team</h6>
                            <p class="mb-0 small">${state.generatedContent?.team || 
                                html`<div class="spinner-border spinner-border-sm text-primary" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>`
                            }</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-6">
                    <div class="card mb-3 h-100">
                        <div class="card-body text-center d-flex flex-column justify-content-center" style="min-height: 120px;">
                            <h6 class="fw-bold">Sponsor</h6>
                            <p class="mb-0 small">${state.generatedContent?.sponsor || 
                                html`<div class="spinner-border spinner-border-sm text-primary" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>`
                            }</p>
                        </div>
                    </div>
                </div>
                <div class="col-6">
                    <div class="card mb-3 h-100">
                        <div class="card-body text-center d-flex flex-column justify-content-center" style="min-height: 120px;">
                            <h6 class="fw-bold">Document Links</h6>
                            <div class="small">
                                ${state.generatedContent?.documentLinks ? 
                                    unsafeHTML(marked.parse(state.generatedContent.documentLinks)) :
                                    html`<div class="spinner-border spinner-border-sm text-primary" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>`
                                }
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
`;
