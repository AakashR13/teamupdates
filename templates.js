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
            <h4 class="mb-3 fw-bold">Status Update</h4>
            <div class="status-update-container" style="height: 600px; overflow-y: auto;">
                <!-- Achieved Section -->
                <div class="mb-4">
                    <h6 class="fw-bold mb-3">Achieved</h6>
                    <div id="achieved-content" style="margin-left: 1.5rem; cursor: pointer; padding: 8px; border-radius: 4px;" 
                         title="Click to edit" 
                         @click=${() => window.editContent('achieved-content', 'summary')}>
                        ${state.generatedContent?.summary ? unsafeHTML(marked.parse(state.generatedContent.summary)) : 
                            html`<div class="text-muted">Click to add achieved content...</div>`
                        }
                    </div>
                </div>

                <!-- Coming Up / Next Steps Section -->
                <div>
                    <h6 class="fw-bold mb-3">Coming Up / Next Steps</h6>
                    <div id="next-steps" class="next-steps-content" style="margin-left: 1.5rem; cursor: pointer; padding: 8px; border-radius: 4px;" 
                         title="Click to edit" 
                         @click=${() => window.editContent('next-steps', 'nextSteps')}>
                        ${state.generatedContent?.nextSteps ? unsafeHTML(marked.parse(state.generatedContent.nextSteps)) : 
                            html`<div class="text-muted">Click to add next steps content...</div>`
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

        <!-- Right Column -->
        <div class="col-lg-6">
            <!-- Key Risks/Issues/Dependencies -->
            <h6 class="mb-3 fw-bold">Key Risks / Issues / Dependencies</h6>
            <div class="card mb-3">
                <div class="card-header bg-primary text-white">
                    <div class="row fw-bold">
                        <div class="col">Risk / Issue Description & Mitigation</div>
                        <div class="col-2">Due by</div>
                        <div class="col-2">Owner</div>
                        <div class="col-1">RGA</div>
                    </div>
                </div>
                <div class="card-body p-0">
                    <div id="risks" style="cursor: pointer; min-height: 100px;" 
                         title="Click to edit risks" 
                         @click=${() => window.editTableContent('risks', 'risks')}>
                        ${state.generatedContent?.risks?.length ? 
                            state.generatedContent.risks.map(risk => html`
                                <div class="row border-bottom py-3 mx-0">
                                    <div class="col px-3">
                                        <ul class="mb-0 ps-3">
                                            <li>${risk.description}</li>
                                        </ul>
                                    </div>
                                    <div class="col-2 px-3 d-flex align-items-center">${risk.dueBy}</div>
                                    <div class="col-2 px-3 d-flex align-items-center">${risk.owner}</div>
                                    <div class="col-1 px-3 d-flex align-items-center justify-content-center">
                                        <span class="status-dot ${risk.ra === 'High' ? 'red' : risk.ra === 'Medium' ? 'yellow' : 'green'}"></span>
                                    </div>
                                </div>
                            `) :
                            html`<div class="text-center py-3 text-muted">
                                Click to add risks and issues...
                            </div>`
                        }
                    </div>
                </div>
            </div>

            <!-- Core Milestone/Change Moments -->
            <h6 class="mb-3 fw-bold">Core Milestone / Change Moments</h6>
            <div class="card mb-3">
                <div class="card-header bg-primary text-white">
                    <div class="row fw-bold">
                        <div class="col">Milestone</div>
                        <div class="col-3">Forecast Date</div>
                        <div class="col-2">Status</div>
                    </div>
                </div>
                <div class="card-body p-0">
                    <div id="milestones" style="cursor: pointer; min-height: 100px;" 
                         title="Click to edit milestones" 
                         @click=${() => window.editTableContent('milestones', 'milestones')}>
                        ${state.generatedContent?.milestones?.length ? 
                            state.generatedContent.milestones.map(milestone => html`
                                <div class="row border-bottom py-3 mx-0">
                                    <div class="col px-3">
                                        <ul class="mb-0 ps-3">
                                            <li>${milestone.milestone}</li>
                                        </ul>
                                    </div>
                                    <div class="col-3 px-3 d-flex align-items-center">${milestone.forecastDate}</div>
                                    <div class="col-2 px-3 d-flex align-items-center">
                                        <span class="status-dot ${milestone.status === 'Complete' ? 'green' : milestone.status === 'In progress' ? 'blue' : milestone.status === 'On track' ? 'green' : 'yellow'}"></span>
                                        <span class="ms-2">${milestone.status}</span>
                                    </div>
                                </div>
                            `) :
                            html`<div class="text-center py-3 text-muted">
                                Click to add milestones...
                            </div>`
                        }
                    </div>
                </div>
            </div>

        </div>
    </div>
    
    <!-- Fixed Footer Bar -->
    <div class="footer-bar">
        <div class="container-fluid">
            <div class="row">
                <div class="col-3">
                    <div class="footer-item">
                        <h6>PM/Workstream Lead</h6>
                        <p id="pm-team-text" style="cursor: pointer; padding: 2px 4px; border-radius: 3px;" 
                           title="Click to edit" 
                           @click=${() => window.editInlineContent('pm-team-text', 'pmTeam')}>
                            ${state.generatedContent?.pmTeam || 'Click to add PM/Workstream Lead'}
                        </p>
                    </div>
                </div>
                <div class="col-3">
                    <div class="footer-item">
                        <h6>Team</h6>
                        <p id="team-text" style="cursor: pointer; padding: 2px 4px; border-radius: 3px;" 
                           title="Click to edit" 
                           @click=${() => window.editInlineContent('team-text', 'team')}>
                            ${state.generatedContent?.team || 'Click to add Team'}
                        </p>
                    </div>
                </div>
                <div class="col-3">
                    <div class="footer-item">
                        <h6>Sponsor</h6>
                        <p id="sponsor-text" style="cursor: pointer; padding: 2px 4px; border-radius: 3px;" 
                           title="Click to edit" 
                           @click=${() => window.editInlineContent('sponsor-text', 'sponsor')}>
                            ${state.generatedContent?.sponsor || 'Click to add Sponsor'}
                        </p>
                    </div>
                </div>
                <div class="col-3">
                    <div class="footer-item">
                        <h6>Document Links</h6>
                        <div id="document-links-text" class="document-links" style="cursor: pointer; padding: 2px 4px; border-radius: 3px;" 
                             title="Click to edit" 
                             @click=${() => window.editContent('document-links-text', 'documentLinks')}>
                            ${state.generatedContent?.documentLinks ? 
                                unsafeHTML(marked.parse(state.generatedContent.documentLinks)) :
                                'Click to add Document Links'
                            }
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
`;
