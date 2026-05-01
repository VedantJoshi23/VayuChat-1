# Air Quality Analysis - On-Device LLM App

A production-ready React Native application that runs LLM inference on-device with Python code execution for air quality data analysis.

## 🌟 Features

- **Dual Inference Modes**
  - Tool Calling: Structured function execution
  - Direct Inference: Python code generation

- **Multiple Model Support**
  - GGUF (llama.cpp compatible)
  - PTE (ExecuTorch)
  - ONNX

- **On-Device Python Execution**
  - Chaquopy runtime (Android)
  - Sandbox execution with security policies
  - Support for pandas, numpy, matplotlib

- **Air Quality Data Analysis**
  - Load .pkl datasets
  - Compute statistics and metrics
  - Generate visualizations

- **Chat Persistence**
  - SQLite database
  - Conversation history
  - Tool call logging

## 📁 Project Structure

```
src/
├── screens/              # UI screens
├── components/           # Reusable components
├── services/
│   ├── llmEngine/       # LLM inference engines
│   ├── pythonExecution/ # Python code execution
│   └── datasetManager/  # Dataset loading
├── store/               # Zustand state stores
├── database/            # SQLite schemas and repos
├── types/               # TypeScript definitions
├── utils/               # Utilities
├── theme/               # Colors, typography, spacing
└── navigation/          # App navigation
```

## ✅ Phase 1 Complete

Foundation layer established with:
- 5 TypeScript type files (chat, models, common, toolCalling, python)
- SQLite schema with 5 tables + indexes
- 4 Zustand stores (chat, model, settings, execution)
- Theme system (colors, typography, spacing)
- LLM engine abstraction + 2 implementations (mock)
- Python executor + security sandbox
- Utility functions (parsing, formatting, validation)
- Basic tab navigation with 3 screens

## 🚀 Next: Phase 2 - UI Components

Need to build:
- ChatBubble, MarkdownRenderer, CodeBlock components
- Chat interface with message list
- Settings UI for model/tokenizer selection
- Chat history list view

## 📦 Dependencies Installed

zustand, react-native-sqlite-storage, react-navigation, axios, uuid, markdown-display

---

**Ready for Phase 2**: Run `npm start` and begin UI implementation.
