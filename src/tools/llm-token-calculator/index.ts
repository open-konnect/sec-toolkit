import React from 'react';
import { llmTokenCalculatorMetadata } from './metadata';
import { ToolDefinition } from '../../types';

const LlmTokenCalculatorTool = React.lazy(() =>
  import('./components/LlmTokenCalculatorTool').then((module) => ({ default: module.LlmTokenCalculatorTool }))
);

export const llmTokenCalculatorToolDefinition: ToolDefinition = {
  ...llmTokenCalculatorMetadata,
  component: LlmTokenCalculatorTool
};

export default LlmTokenCalculatorTool;
