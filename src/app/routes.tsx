import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { HomePage } from '../pages/HomePage';
import { ToolPage } from '../pages/ToolPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { REGISTERED_TOOLS } from '../tools/registry';
import { analytics } from '../lib/analytics';

/**
 * Scroll to top on every route change.
 */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    analytics.pageView(pathname);
  }, [pathname]);

  return null;
}

export const AppRoutes: React.FC = () => {
  return (
    <Layout>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />

        {/* Explicit canonical routes for initial tools */}
        {REGISTERED_TOOLS.map((tool) => (
          <Route
            key={tool.id}
            path={`/${tool.slug}`}
            element={<ToolPage toolDefinition={tool} />}
          />
        ))}

        {/* Dynamic fallback route for future registered tools */}
        <Route path="/:slug" element={<ToolPage />} />

        {/* 404 Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
};
