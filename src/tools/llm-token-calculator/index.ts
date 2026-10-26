import { llmTokenCalculatorMetadata } from './metadata';
import { LlmTokenCalculatorTool } from './components/LlmTokenCalculatorTool';
import { ToolDefinition } from '../../types';

export const llmTokenCalculatorToolDefinition: ToolDefinition = {
  ...llmTokenCalculatorMetadata,
  component: LlmTokenCalculatorTool
};

export default LlmTokenCalculatorTool;
