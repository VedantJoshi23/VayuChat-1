/**
 * Pre-defined Python functions and examples for air quality analysis
 * These are injected into the Python environment for easy access
 */

export const AIR_QUALITY_TOOLS = `
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from datetime import datetime, timedelta

# ============ AIR QUALITY ANALYSIS TOOLS ============

def load_air_quality_data(dataset_path: str = 'air_quality.pkl') -> pd.DataFrame:
    """
    Load air quality dataset from pickle file

    Returns:
        DataFrame with columns: date, pm25, pm10, o3, no2, so2, co
    """
    try:
        df = pd.read_pickle(dataset_path)
        print(f"Loaded dataset: {df.shape[0]} rows, {df.shape[1]} columns")
        print(f"Columns: {', '.join(df.columns)}")
        return df
    except Exception as e:
        print(f"Error loading dataset: {e}")
        return None

def filter_data(df: pd.DataFrame, condition: str) -> pd.DataFrame:
    """
    Filter dataset by condition (e.g., "pm25 > 35")

    Args:
        df: DataFrame to filter
        condition: Pandas query condition

    Returns:
        Filtered DataFrame
    """
    try:
        filtered = df.query(condition)
        print(f"Filtered {len(df)} rows to {len(filtered)} rows")
        return filtered
    except Exception as e:
        print(f"Error filtering data: {e}")
        return df

def compute_statistics(df: pd.DataFrame, columns: list = None) -> dict:
    """
    Compute statistics for air quality metrics

    Args:
        df: DataFrame with measurements
        columns: Columns to analyze (default: all numeric)

    Returns:
        Dictionary with statistics
    """
    try:
        if columns is None:
            columns = df.select_dtypes(include=[np.number]).columns.tolist()

        stats = {
            'mean': df[columns].mean().to_dict(),
            'median': df[columns].median().to_dict(),
            'std': df[columns].std().to_dict(),
            'min': df[columns].min().to_dict(),
            'max': df[columns].max().to_dict(),
        }

        print("Statistics computed successfully")
        for key, value in stats.items():
            print(f"{key}: {value}")

        return stats
    except Exception as e:
        print(f"Error computing statistics: {e}")
        return {}

def generate_plot(df: pd.DataFrame, plot_type: str = 'line', columns: list = None, title: str = 'Air Quality Analysis'):
    """
    Generate visualization for air quality data

    Args:
        df: DataFrame to plot
        plot_type: 'line', 'scatter', 'bar', 'box'
        columns: Columns to plot
        title: Plot title
    """
    try:
        if columns is None:
            columns = df.select_dtypes(include=[np.number]).columns.tolist()[:3]

        plt.figure(figsize=(12, 6))

        if plot_type == 'line':
            for col in columns:
                plt.plot(df.index, df[col], label=col, marker='o')
            plt.xlabel('Index')
            plt.ylabel('Concentration (µg/m³)')

        elif plot_type == 'scatter':
            if len(columns) >= 2:
                plt.scatter(df[columns[0]], df[columns[1]], alpha=0.6)
                plt.xlabel(columns[0])
                plt.ylabel(columns[1])

        elif plot_type == 'bar':
            df[columns].mean().plot(kind='bar')
            plt.ylabel('Mean Concentration (µg/m³)')

        elif plot_type == 'box':
            df[columns].plot(kind='box')
            plt.ylabel('Concentration (µg/m³)')

        plt.title(title)
        plt.legend()
        plt.tight_layout()
        plt.savefig('/tmp/air_quality_plot.png', dpi=150, bbox_inches='tight')
        print(f"Plot saved: {plot_type} chart for {', '.join(columns)}")
        plt.show()

    except Exception as e:
        print(f"Error generating plot: {e}")

def get_aqi_category(pm25: float) -> str:
    """
    Get AQI category from PM2.5 value

    Args:
        pm25: PM2.5 concentration in µg/m³

    Returns:
        AQI category name
    """
    if pm25 <= 12:
        return "Good"
    elif pm25 <= 35.4:
        return "Moderate"
    elif pm25 <= 55.4:
        return "Unhealthy for Sensitive Groups"
    elif pm25 <= 150.4:
        return "Unhealthy"
    elif pm25 <= 250.4:
        return "Very Unhealthy"
    else:
        return "Hazardous"

def analyze_trends(df: pd.DataFrame, column: str = 'pm25', window: int = 7) -> pd.DataFrame:
    """
    Analyze air quality trends with rolling average

    Args:
        df: DataFrame with measurements
        column: Column to analyze
        window: Rolling window size (days)

    Returns:
        DataFrame with trend analysis
    """
    try:
        df_trend = df.copy()
        df_trend['rolling_mean'] = df[column].rolling(window=window).mean()
        df_trend['rolling_std'] = df[column].rolling(window=window).std()

        print(f"Trend analysis complete (window={window})")
        print(f"Mean: {df[column].mean():.2f}, Std: {df[column].std():.2f}")

        return df_trend
    except Exception as e:
        print(f"Error analyzing trends: {e}")
        return df

# ============ HELPER FUNCTIONS ============

def print_summary(df: pd.DataFrame):
    """Print dataset summary"""
    print("Dataset Summary:")
    print(f"Shape: {df.shape}")
    print(f"Columns: {list(df.columns)}")
    print(f"Date range: {df.index.min()} to {df.index.max()}")
    print(f"Missing values: {df.isnull().sum().sum()}")

def export_results(df: pd.DataFrame, filename: str):
    """Export analysis results to CSV"""
    try:
        df.to_csv(f'/tmp/{filename}')
        print(f"Results exported to {filename}")
    except Exception as e:
        print(f"Error exporting results: {e}")
`;

export interface AirQualityTool {
  name: string;
  description: string;
  example: string;
}

export const TOOL_EXAMPLES: AirQualityTool[] = [
  {
    name: 'load_air_quality_data',
    description: 'Load air quality measurements from dataset',
    example: `
df = load_air_quality_data('air_quality.pkl')
print(df.head())
    `.trim(),
  },
  {
    name: 'filter_data',
    description: 'Filter measurements by condition',
    example: `
df = load_air_quality_data()
bad_days = filter_data(df, 'pm25 > 35')
print(f"Found {len(bad_days)} days with poor air quality")
    `.trim(),
  },
  {
    name: 'compute_statistics',
    description: 'Calculate mean, median, std, min, max',
    example: `
df = load_air_quality_data()
stats = compute_statistics(df, ['pm25', 'pm10', 'o3'])
    `.trim(),
  },
  {
    name: 'generate_plot',
    description: 'Create visualizations (line, scatter, bar, box)',
    example: `
df = load_air_quality_data()
generate_plot(df, plot_type='line', columns=['pm25', 'pm10'], title='PM Levels Over Time')
    `.trim(),
  },
  {
    name: 'get_aqi_category',
    description: 'Convert PM2.5 to AQI category',
    example: `
category = get_aqi_category(45.5)
print(f"AQI Category: {category}")
    `.trim(),
  },
  {
    name: 'analyze_trends',
    description: 'Calculate rolling averages and trends',
    example: `
df = load_air_quality_data()
trends = analyze_trends(df, column='pm25', window=7)
print(trends[['pm25', 'rolling_mean']].tail())
    `.trim(),
  },
];

/**
 * Create a system prompt for Python code generation
 */
export function createPythonSystemPrompt(): string {
  return `You are an expert Python data analyst specializing in air quality analysis.

You have access to pre-defined functions for air quality analysis:
${TOOL_EXAMPLES.map((t) => `- ${t.name}(): ${t.description}`).join('\n')}

Guidelines:
1. Always load data first using load_air_quality_data()
2. Use appropriate visualization functions for analysis
3. Add clear print statements explaining your findings
4. Handle errors gracefully
5. Use pandas and numpy for data manipulation
6. Create plots when visualizing data

Available libraries: pandas, numpy, matplotlib, pickle, json, math, statistics, datetime

Do NOT use: os, sys, subprocess, eval, exec, __import__

Example analysis:
\`\`\`python
# Load and analyze PM2.5 levels
df = load_air_quality_data()
high_pm = filter_data(df, 'pm25 > 35')
print(f"Days with high PM2.5: {len(high_pm)}")
stats = compute_statistics(df, ['pm25'])
generate_plot(df, plot_type='line', columns=['pm25'])
\`\`\`

Respond with ONLY executable Python code.`;
}
