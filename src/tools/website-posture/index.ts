import React from 'react';
import { websitePostureMetadata } from './metadata';
import { ToolDefinition } from '../../types';

const WebsitePostureTool = React.lazy(() =>
  import('./components/WebsitePostureTool').then((module) => ({
    default: module.WebsitePostureTool
  }))
);

export const websitePostureToolDefinition: ToolDefinition = {
  ...websitePostureMetadata,
  component: WebsitePostureTool
};

export default WebsitePostureTool;
