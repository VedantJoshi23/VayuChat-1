import { BaseLLMEngine } from './LLMEngine';
import { Response, StreamEvent } from '../../types/common';
import { Message } from '../../types/chat';

export class DirectInferenceEngine extends BaseLLMEngine {
  async generate(
    userQuery: string,
    context: Message[],
    onStream: (event: StreamEvent) => void
  ): Promise<Response> {
    if (!this.isReady()) {
      throw new Error('DirectInferenceEngine not initialized');
    }

    const systemPrompt = `You are an expert Python data analyst specializing in air quality analysis.
The user will ask questions about air quality data.
Respond ONLY with valid, executable Python code that uses pandas, numpy, and matplotlib.
The code should load .pkl files from the provided dataset directory.

Important:
- Always start with necessary imports
- Load data using pickle
- Perform analysis
- Create visualizations using matplotlib
- Print results to stdout

Do NOT include explanations, only code.`;

    const contextPrompt = this.buildContextPrompt(context);

    const fullPrompt = `${systemPrompt}

Previous context:
${contextPrompt}

User request: ${userQuery}

Generate Python code:`;

    // TODO: Integrate actual LLM inference here
    const mockCode = this.generateMockCode(userQuery);

    // Simulate streaming tokens
    for (const token of mockCode.split(/(\s+)/)) {
      if (token.trim()) {
        onStream({
          type: 'token',
          content: token,
          timestamp: Date.now(),
        });
      }
    }

    return {
      type: 'direct_inference',
      content: mockCode,
      code: mockCode,
    };
  }

  private generateMockCode(userQuery: string): string {
    // Mock Python code for testing
    if (userQuery.toLowerCase().includes('plot')) {
      return `import pandas as pd
import matplotlib.pyplot as plt

# Load data
df = pd.read_pickle('air_quality.pkl')

# Create visualization
plt.figure(figsize=(10, 6))
plt.plot(df['date'], df['PM25'])
plt.xlabel('Date')
plt.ylabel('PM2.5 (µg/m³)')
plt.title('Air Quality - PM2.5 Levels')
plt.tight_layout()
plt.savefig('/tmp/plot.png')
plt.show()`;
    }

    if (userQuery.toLowerCase().includes('statistics')) {
      return `import pandas as pd

df = pd.read_pickle('air_quality.pkl')
print("Air Quality Statistics:")
print(df.describe())`;
    }

    return `import pandas as pd

df = pd.read_pickle('air_quality.pkl')
print("Data loaded successfully")
print(f"Shape: {df.shape}")
print(df.head())`;
  }
}
