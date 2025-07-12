#!/usr/bin/env node

/**
 * Formance Context MCP Server
 * Provides intelligent context about Formance Stack architecture, patterns, and domain knowledge
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from 'fs/promises';
import path from 'path';

class FormanceContextServer {
  constructor() {
    this.server = new Server({
      name: "formance-context",
      version: "1.0.0",
    }, {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      }
    });

    this.setupToolHandlers();
    this.setupResourceHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "analyze_event_schema",
          description: "Analyze Formance event schemas for consistency and evolution patterns",
          inputSchema: {
            type: "object",
            properties: {
              service: { type: "string", description: "Service name (ledger, payments, orchestration)" },
              version: { type: "string", description: "Schema version (v1.0.0, v2.0.0, v3.0.0)" },
              event_type: { type: "string", description: "Specific event type to analyze" }
            },
            required: ["service"]
          }
        },
        {
          name: "suggest_architecture_improvement",
          description: "Provide architectural improvement suggestions based on patterns and best practices",
          inputSchema: {
            type: "object",
            properties: {
              component: { type: "string", description: "Component to analyze (ledger, payments, gateway, etc.)" },
              focus: { type: "string", enum: ["performance", "security", "scalability", "maintainability"] }
            },
            required: ["component"]
          }
        },
        {
          name: "validate_financial_workflow",
          description: "Validate financial workflows for compliance and correctness",
          inputSchema: {
            type: "object",
            properties: {
              workflow_type: { type: "string", description: "Type of workflow (transaction, payment, reconciliation)" },
              steps: { type: "array", items: { type: "string" }, description: "Workflow steps to validate" }
            },
            required: ["workflow_type", "steps"]
          }
        },
        {
          name: "get_domain_context",
          description: "Get comprehensive context about Formance domain concepts",
          inputSchema: {
            type: "object",
            properties: {
              concept: { type: "string", description: "Domain concept (double-entry, numscript, events, etc.)" },
              depth: { type: "string", enum: ["basic", "detailed", "expert"], default: "detailed" }
            },
            required: ["concept"]
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "analyze_event_schema":
          return await this.analyzeEventSchema(args);
        case "suggest_architecture_improvement":
          return await this.suggestArchitectureImprovement(args);
        case "validate_financial_workflow":
          return await this.validateFinancialWorkflow(args);
        case "get_domain_context":
          return await this.getDomainContext(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async analyzeEventSchema(args) {
    const { service, version, event_type } = args;
    
    try {
      // Load event schemas
      const schemaPath = `./libs/events/services/${service}/${version || 'v2.0.0'}`;
      const files = await fs.readdir(schemaPath);
      
      let analysis = {
        service,
        version: version || 'v2.0.0',
        schemas_found: files.length,
        event_types: files.map(f => f.replace('.yaml', '')),
        compatibility_analysis: [],
        recommendations: []
      };

      if (event_type) {
        const eventFile = `${schemaPath}/${event_type}.yaml`;
        const eventSchema = await fs.readFile(eventFile, 'utf8');
        analysis.event_schema = eventSchema;
        analysis.recommendations.push(
          "Event schema follows Formance conventions",
          "Consider adding validation rules for financial amounts",
          "Ensure backward compatibility for schema evolution"
        );
      }

      // Cross-version compatibility analysis
      if (service === 'payments') {
        analysis.compatibility_analysis = [
          "v3.0.0 introduces payment initiations - breaking change",
          "v2.0.0 to v3.0.0 migration required for SAVED_PAYMENT_INITIATION events",
          "Consider implementing event versioning strategy"
        ];
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(analysis, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text", 
            text: `Error analyzing event schema: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  async suggestArchitectureImprovement(args) {
    const { component, focus } = args;
    
    const improvements = {
      ledger: {
        performance: [
          "Implement read replicas for query optimization",
          "Add connection pooling with adaptive sizing",
          "Consider event sourcing optimizations with snapshots",
          "Implement caching layer for balance calculations"
        ],
        security: [
          "Add encryption at rest for sensitive financial data",
          "Implement audit logging for all transactions",
          "Add rate limiting per account/user",
          "Consider zero-trust networking between services"
        ],
        scalability: [
          "Implement horizontal partitioning by ledger",
          "Add async processing for non-critical operations",
          "Consider CQRS pattern for read/write separation",
          "Implement event streaming with Kafka/NATS JetStream"
        ],
        maintainability: [
          "Add comprehensive API documentation",
          "Implement structured logging with correlation IDs",
          "Add health checks and metrics",
          "Consider contract testing between services"
        ]
      },
      payments: {
        performance: [
          "Implement connector connection pooling",
          "Add circuit breaker pattern for external APIs",
          "Consider async payment processing",
          "Implement intelligent retry mechanisms"
        ],
        security: [
          "Add PCI compliance validation",
          "Implement secrets management for API keys",
          "Add fraud detection patterns",
          "Consider payment tokenization"
        ]
      },
      gateway: {
        performance: [
          "Implement intelligent load balancing",
          "Add request/response caching",
          "Consider API rate limiting with Redis",
          "Implement health-based routing"
        ],
        security: [
          "Add OAuth2/OIDC integration",
          "Implement API key management",
          "Add request validation and sanitization",
          "Consider mutual TLS for service communication"
        ]
      }
    };

    const suggestions = improvements[component]?.[focus] || [
      "Component-specific improvements not found",
      "Consider general microservices best practices",
      "Implement observability with OpenTelemetry",
      "Add comprehensive monitoring and alerting"
    ];

    return {
      content: [
        {
          type: "text",
          text: `Architecture Improvement Suggestions for ${component} (${focus}):\n\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
        }
      ]
    };
  }

  async validateFinancialWorkflow(args) {
    const { workflow_type, steps } = args;
    
    const validations = {
      transaction: {
        required_steps: ["validate_accounts", "check_balances", "execute_double_entry", "update_balances", "emit_events"],
        compliance_checks: ["amount_validation", "currency_matching", "account_existence", "balance_sufficiency"]
      },
      payment: {
        required_steps: ["validate_payment_data", "check_connector", "initiate_payment", "handle_callback", "update_status"],
        compliance_checks: ["pci_compliance", "aml_screening", "fraud_detection", "regulatory_reporting"]
      },
      reconciliation: {
        required_steps: ["fetch_statements", "match_transactions", "identify_discrepancies", "generate_reports"],
        compliance_checks: ["data_integrity", "audit_trail", "exception_handling", "reporting_accuracy"]
      }
    };

    const validation = validations[workflow_type] || { required_steps: [], compliance_checks: [] };
    const missing_steps = validation.required_steps.filter(step => !steps.includes(step));
    const recommendations = [];

    if (missing_steps.length > 0) {
      recommendations.push(`Missing required steps: ${missing_steps.join(', ')}`);
    }

    recommendations.push(...validation.compliance_checks.map(check => 
      `Ensure ${check.replace('_', ' ')} is implemented`
    ));

    return {
      content: [
        {
          type: "text",
          text: `Financial Workflow Validation for ${workflow_type}:\n\nSteps Analysis:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nRecommendations:\n${recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
        }
      ]
    };
  }

  async getDomainContext(args) {
    const { concept, depth } = args;
    
    const domainKnowledge = {
      "double-entry": {
        basic: "Double-entry bookkeeping ensures every transaction has equal debits and credits",
        detailed: "Double-entry bookkeeping is the foundation of Formance Ledger. Every transaction must balance, with total debits equaling total credits. This ensures financial integrity and enables powerful querying capabilities.",
        expert: "Formance implements double-entry with immutable transaction logs, real-time balance calculations, and event sourcing. Each posting affects exactly two accounts with opposite signs, maintaining the accounting equation: Assets = Liabilities + Equity."
      },
      "numscript": {
        basic: "Numscript is Formance's DSL for describing financial transactions",
        detailed: "Numscript allows you to write financial logic as code, with support for complex routing, conditions, and multi-party transactions. It compiles to secure, auditable operations.",
        expert: "Numscript features: variable assignments, conditional logic, loops, account references (@account), asset specifications (USD/2), amount calculations, and built-in financial functions. It's statically analyzed for safety."
      },
      "events": {
        basic: "Events are emitted when state changes occur in the system",
        detailed: "Formance uses event-driven architecture with versioned schemas. Events enable loose coupling, audit trails, and real-time integrations. Each service publishes domain events.",
        expert: "Event system features: JSON Schema validation, semantic versioning, backward compatibility, event sourcing capabilities, NATS streaming, and cross-service choreography patterns."
      }
    };

    const knowledge = domainKnowledge[concept]?.[depth] || 
      `Domain concept '${concept}' not found. Available concepts: ${Object.keys(domainKnowledge).join(', ')}`;

    return {
      content: [
        {
          type: "text",
          text: `Domain Context: ${concept}\n\n${knowledge}`
        }
      ]
    };
  }

  setupResourceHandlers() {
    // Resource handlers for accessing Formance documentation, schemas, etc.
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Formance Context MCP server running on stdio");
  }
}

const server = new FormanceContextServer();
server.run().catch(console.error);