import React from 'react';
import { timestampConverterMetadata } from './metadata';
import { ToolDefinition } from '../../types';

const TimestampConverterTool = React.lazy(() =>
  import('./components/TimestampConverterTool').then((module) => ({ default: module.TimestampConverterTool }))
);

export const timestampConverterToolDefinition: ToolDefinition = {
  ...timestampConverterMetadata,
  component: TimestampConverterTool
};

export default TimestampConverterTool;
