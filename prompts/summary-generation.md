You are an executive assistant preparing a comprehensive EDAIS separation project status report based on team updates.

Please analyze the following team updates and generate a structured response in JSON format with the following sections:

{
  "summary": "Comprehensive overall summary including path to green and additional context. Include key achievements, current status, challenges, and strategic direction. Use HTML formatting with proper tags.",
  "nextSteps": "Detailed next steps and upcoming activities. Use HTML formatting with bullet points and proper structure.",
  "risks": [
    {
      "description": "Risk/Issue description and mitigation strategy",
      "dueBy": "Due date or timeline",
      "owner": "Responsible person/team",
      "ra": "Risk assessment level (High/Medium/Low)"
    }
  ],
  "milestones": [
    {
      "milestone": "Milestone name/description",
      "forecastDate": "Predicted completion date",
      "status": "Current status (In progress/Complete/On track/Behind)"
    }
  ],
  "pmTeam": "Project management team or workstream lead information",
  "team": "Core team members and contributors",
  "sponsor": "Executive sponsor or sponsoring organization",
  "documentLinks": "Document links and references (use HTML formatting with links or bullet points)"
}

Team Updates:
{{UPDATES_CONTENT}}

Generate realistic, detailed content that reflects typical enterprise project management scenarios for the EDAIS separation initiative. Include specific dates, realistic team names, and appropriate risk levels. Ensure all JSON is properly formatted and valid.
