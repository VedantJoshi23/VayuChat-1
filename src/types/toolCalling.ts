export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ParameterDef>;
    required: string[];
  };
}

export interface ParameterDef {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: unknown[];
  items?: ParameterDef;
}

export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  timestamp: number;
}

export interface ToolCallResult {
  id: string;
  toolName: string;
  success: boolean;
  output: unknown;
  error?: string;
  executionTime: number;
}

export const AIR_QUALITY_TOOLS: ToolDefinition[] = [
  {
    name: 'load_air_quality_data',
    description: 'Load air quality dataset from local pickle file',
    parameters: {
      type: 'object' as const,
      properties: {
        dataset_name: {
          type: 'string' as const,
          description: 'Name of the dataset (e.g., "air_quality_data")',
        },
      },
      required: ['dataset_name'],
    },
  },
  {
    name: 'filter_data',
    description: 'Filter data based on conditions',
    parameters: {
      type: 'object' as const,
      properties: {
        condition: {
          type: 'string' as const,
          description: 'Filter condition (e.g., "PM25 > 100")',
        },
      },
      required: ['condition'],
    },
  },
  {
    name: 'compute_statistics',
    description: 'Compute statistics on the data',
    parameters: {
      type: 'object' as const,
      properties: {
        metric: {
          type: 'string' as const,
          description: 'Metric to compute (mean, median, std, etc.)',
        },
      },
      required: ['metric'],
    },
  },
  {
    name: 'generate_plot',
    description: 'Generate a visualization plot',
    parameters: {
      type: 'object' as const,
      properties: {
        plot_type: {
          type: 'string' as const,
          enum: ['line', 'bar', 'scatter', 'heatmap', 'histogram'],
          description: 'Type of plot to generate',
        },
        columns: {
          type: 'array' as const,
          items: { type: 'string' as const, description: 'Column name' },
          description: 'Columns to plot',
        },
      },
      required: ['plot_type', 'columns'],
    },
  },
];
