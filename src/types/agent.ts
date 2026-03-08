export interface AgentCommandTemplates {
  interactive?: string;
  print?: string;
  print_json?: string;
}

export interface AgentConfig {
  default: string;
  [agentName: string]: string | AgentCommandTemplates;
}
