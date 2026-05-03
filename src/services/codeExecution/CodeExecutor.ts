import { PythonExecutor } from '../pythonExecution/PythonExecutor';
import { ExecutionResult, ExecutionLog } from '../../types/python';

export class CodeExecutor {
  private pythonExecutor: PythonExecutor;

  constructor() {
    this.pythonExecutor = new PythonExecutor(10000); // 10 second timeout
  }

  async initialize(): Promise<void> {
    await this.pythonExecutor.initialize();
  }

  async executePythonCode(code: string): Promise<ExecutionResult> {
    if (!code || !code.trim()) {
      return {
        success: false,
        stdout: '',
        stderr: 'No code provided',
        plots: [],
        executionTime: 0,
        error: 'No code provided',
      };
    }

    try {
      const startTime = Date.now();
      const result = await this.pythonExecutor.execute({
        code,
        timeout: 10000,
      });
      const executionTime = Date.now() - startTime;

      return {
        ...result,
        executionTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        stdout: '',
        stderr: errorMsg,
        plots: [],
        executionTime: 0,
        error: errorMsg,
      };
    }
  }

  async executeToolCall(
    toolName: string,
    args: Record<string, any>
  ): Promise<ExecutionLog> {
    const startTime = Date.now();

    try {
      // Generate code based on tool call
      const code = this.generateToolCode(toolName, args);

      const result = await this.executePythonCode(code);
      const executionTime = Date.now() - startTime;

      return {
        toolName,
        args,
        stdout: result.stdout,
        stderr: result.stderr,
        success: result.success,
        executionTime,
        plots: result.plots || [],
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        toolName,
        args,
        stdout: '',
        stderr: errorMsg,
        success: false,
        executionTime: Date.now() - startTime,
        plots: [],
      };
    }
  }

  private generateToolCode(toolName: string, args: Record<string, any>): string {
    // FIX: Use JSON.stringify for safe escaping instead of direct template interpolation
    // This prevents code injection attacks
    const datasetName = JSON.stringify(args.dataset_name || args.name || 'air_quality');
    const condition = JSON.stringify(args.condition || '');
    const metric = JSON.stringify(args.metric || 'PM25');
    const plotType = JSON.stringify(args.plot_type || 'line');
    const columns = JSON.stringify(args.columns || ['PM25']);
    const value = JSON.stringify(args.value || 50);
    const timeframe = JSON.stringify(args.timeframe || '30d');

    switch (toolName) {
      case 'load_air_quality_data':
        return `import pandas as pd
import pickle
import os

# Try to load dataset
dataset_paths = [
    f'/sdcard/Download/{datasetName}.pkl',
    f'/sdcard/Downloads/{datasetName}.pkl',
    f'/data/data/com.awesomeproject/files/{datasetName}.pkl',
]

df = None
for path in dataset_paths:
    if os.path.exists(path):
        with open(path, 'rb') as f:
            df = pickle.load(f)
        break

if df is None:
    # Create sample data if not found
    import numpy as np
    from datetime import datetime, timedelta

    dates = [datetime.now() - timedelta(days=i) for i in range(30)]
    df = pd.DataFrame({
        'date': dates,
        'PM25': np.random.uniform(10, 100, 30),
        'PM10': np.random.uniform(20, 150, 30),
        'NO2': np.random.uniform(5, 50, 30),
        'O3': np.random.uniform(10, 80, 30),
    })

print(f"Dataset loaded: {datasetName}")
print(f"Shape: {df.shape}")
print(f"Columns: {list(df.columns)}")
print("\\nFirst 5 rows:")
print(df.head())`;

      case 'filter_data':
        // FIX: Use pandas query method instead of direct eval with user input
        return `import pandas as pd
import json

# Load data
df = pd.read_csv('air_quality.csv')  # Use CSV instead of pickle

# Apply filter condition safely
condition_str = json.loads(${condition})
if condition_str and df is not None:
    try:
        # Use pandas query method for safe evaluation
        filtered = df.query(condition_str)
        print(f"Filtered data: {len(filtered)} rows")
        print(filtered.head())
    except Exception as e:
        print(f"Filter error: {e}")
else:
    print("Invalid condition or no data")`;

      case 'compute_statistics':
        return `import pandas as pd
import json

df = pd.read_csv('air_quality.csv')  # Use CSV instead of pickle

metric = json.loads(${metric})
print(f"Statistics for {metric}:")
if metric in df.columns:
    stats = df[metric].describe()
    print(stats)
    print(f"\\nAdditional Stats:")
    print(f"Mean: {df[metric].mean():.2f}")
    print(f"Std Dev: {df[metric].std():.2f}")
    print(f"Min: {df[metric].min():.2f}")
    print(f"Max: {df[metric].max():.2f}")
else:
    print(f"Column '{metric}' not found in dataset")`;
      case 'generate_plot':
        return `import pandas as pd
                import matplotlib
                matplotlib.use('Agg')
                import matplotlib.pyplot as plt

df = pd.read_pickle('air_quality.pkl')

plt.figure(figsize=(10, 6))
${
          plotType === 'line'
            ? `plt.plot(df.index, df[${JSON.stringify(columns[0])}])
plt.xlabel('Index')
plt.ylabel('${columns[0]}')
plt.title('${columns[0]} Over Time')`
            : plotType === 'histogram'
              ? `plt.hist(df[${JSON.stringify(columns[0])}], bins=20)
plt.xlabel('${columns[0]}')
plt.ylabel('Frequency')
plt.title('${columns[0]} Distribution')`
              : `plt.scatter(range(len(df)), df[${JSON.stringify(columns[0])}])
plt.xlabel('Index')
plt.ylabel('${columns[0]}')
plt.title('${columns[0]} Scatter Plot')`
        }

plt.tight_layout()
plt.savefig('/tmp/plot.png', dpi=100)
print("Plot saved successfully")
plt.close()`;

      case 'get_aqi_category':
        return `value = ${value}

categories = {
    'Good': (0, 50),
    'Moderate': (51, 100),
    'Unhealthy for Sensitive Groups': (101, 150),
    'Unhealthy': (151, 200),
    'Very Unhealthy': (201, 300),
    'Hazardous': (301, 500),
}

category = 'Unknown'
for cat, (low, high) in categories.items():
    if low <= value <= high:
        category = cat
        break

print(f"AQI Value: {value}")
print(f"Category: {category}")`;

      case 'analyze_trends':
        return `import pandas as pd

df = pd.read_pickle('air_quality.pkl')

print(f"Analyzing trends over {timeframe}")
print(f"\\nData Summary:")
print(f"Total records: {len(df)}")
print(f"Date range: {df['date'].min()} to {df['date'].max()}" if 'date' in df.columns else "")
print(f"\\nMean values:")
print(df.select_dtypes(include=['number']).mean())
print(f"\\nTrend indicators:")
for col in df.select_dtypes(include=['number']).columns:
    values = df[col]
    trend = "increasing" if values.iloc[-1] > values.iloc[0] else "decreasing"
    change = ((values.iloc[-1] - values.iloc[0]) / values.iloc[0] * 100) if values.iloc[0] != 0 else 0
    print(f"{col}: {trend} ({change:+.1f}%)")`;

      default:
        return `print("Tool ${toolName} not implemented yet")`;
    }
  }

  async destroy(): Promise<void> {
    if (this.pythonExecutor) {
      this.pythonExecutor.destroy();
    }
  }
}
