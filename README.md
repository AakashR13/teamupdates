# Team Updates Aggregator

A lightweight GenAI-powered utility for collecting, organizing, and summarizing team updates for leadership reporting.

## Overview

Team Updates Aggregator streamlines the process of gathering team progress reports and automatically generates executive summaries using AI. The application provides real-time markdown rendering and supports multiple AI providers for flexible deployment.

## Features

- **Team Update Collection**: Structured input for team name, reporting period, and update content
- **AI-Powered Summarization**: Generates executive summaries with key highlights, themes, and action items
- **Real-time Streaming**: Live display of AI-generated content as it's created
- **Multiple AI Providers**: Supports OpenAI, Anthropic, and OpenRouter APIs
- **Persistent Storage**: Local storage for updates and AI configuration
- **Responsive Design**: Bootstrap-based UI that works across devices
- **Markdown Support**: Professional formatting with marked.js

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **UI Framework**: Bootstrap 5.3.2
- **Template Engine**: lit-html 3.1.0
- **Markdown Rendering**: marked.js 9.1.6
- **AI Integration**: bootstrap-llm-provider, asyncllm
- **Icons**: Bootstrap Icons 1.11.2

## Installation

1. Clone or download the repository
2. Open `index.html` in a modern web browser
3. No build process or dependencies required

## Usage

### Initial Setup

1. Click "Configure LLM" to set up your AI provider
2. Enter your API base URL and API key
3. Configuration is saved locally for future sessions

### Adding Updates

1. Fill in the team name, reporting period, and update content
2. Click "Add Update" to save the information
3. Updates are stored locally and displayed in the current updates panel

### Generating Summaries

1. Add one or more team updates
2. Click "Generate Summary" to create an AI-powered executive summary
3. The summary appears with real-time streaming as content is generated
4. Summaries include key highlights, cross-team themes, strategic insights, and action items

### Managing Updates

- **View Updates**: All current updates are displayed with team name, date, and content preview
- **Remove Updates**: Click the trash icon to remove individual updates
- **Clear All**: Remove all updates at once with confirmation

## AI Provider Configuration

The application supports multiple AI providers through the bootstrap-llm-provider library:

- **OpenAI**: `https://api.openai.com/v1`
- **Anthropic**: `https://api.anthropic.com/v1` 
- **OpenRouter**: `https://openrouter.ai/api/v1`
- **Custom**: Any OpenAI-compatible API endpoint

## File Structure

```
updates-poc/
├── index.html          # Main application interface
├── script.js           # Application logic and AI integration
├── README.md           # Project documentation
└── LICENSE             # MIT license
```

## Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

Requires support for ES6 modules, async/await, and modern JavaScript features.

## API Requirements

- AI provider API key with chat completion capabilities
- Streaming support for real-time content generation
- OpenAI-compatible API format

## Data Storage

All data is stored locally in the browser using localStorage:

- **Team Updates**: Saved as `team-updates` key
- **AI Configuration**: Saved as `llm-config` key
- **No server required**: Fully client-side application

## Development

The application uses modern JavaScript patterns:

- Functional programming approach
- ES6 modules and destructuring
- Async/await for API calls
- Template literals and arrow functions
- Minimal DOM manipulation with lit-html

## Customization

### Styling
Modify Bootstrap classes in `index.html` or add custom CSS for appearance changes.

### AI Prompts
Edit the prompt template in `script.js` to customize summary generation format and content.

### Storage
Replace localStorage calls with your preferred storage solution for persistence.

## Performance

- Lightweight: No external dependencies beyond CDN resources
- Fast loading: Minimal JavaScript bundle size
- Efficient rendering: lit-html templates for optimized DOM updates
- Streaming: Real-time content display reduces perceived latency

## Security Considerations

- API keys are stored in browser localStorage
- All processing happens client-side
- No data transmission to third parties except configured AI provider
- Consider key rotation and secure storage for production use

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly across browsers
5. Submit a pull request

## Support

For issues, questions, or feature requests, please create an issue in the project repository.

## Changelog

### Version 1.0.0
- Initial release with core functionality
- AI-powered summary generation
- Real-time streaming support
- Multi-provider AI configuration
- Local storage persistence
