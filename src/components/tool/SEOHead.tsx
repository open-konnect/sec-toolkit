import React, { useEffect } from 'react';
import { PageSeo } from '../../seo/pages';
import { applySeoHead, buildSeoHead } from '../../seo/head';
import { shouldIndexCurrentPage } from '../../seo/config';

export interface SEOHeadProps {
  seo: PageSeo;
}

/**
 * Keeps document metadata in sync during client-side navigation.
 *
 * Production HTML also contains the same tags because scripts/generate-seo.mjs
 * prerenders every indexable route and injects its head at build time.
 */
export const SEOHead: React.FC<SEOHeadProps> = ({ seo }) => {
  useEffect(() => {
    applySeoHead(buildSeoHead(seo, { indexable: shouldIndexCurrentPage() }));
  }, [seo]);

  return null;
};
