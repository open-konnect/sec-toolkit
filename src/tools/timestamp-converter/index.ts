import { timestampConverterMetadata } from './metadata';
import { TimestampConverterTool } from './components/TimestampConverterTool';
import { ToolDefinition } from '../../types';

export const timestampConverterToolDefinition: ToolDefinition = {
  ...timestampConverterMetadata,
  component: TimestampConverterTool
};

export default TimestampConverterTool;
