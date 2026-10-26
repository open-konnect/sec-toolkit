import React, { useEffect } from 'react';
import { FaqItem } from '../../types';

export interface SEOHeadProps {
  title: string;
  description: string;
  canonicalPath?: string;
  keywords?: string[];
  faqs?: FaqItem[];
}

export const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  description,
  canonicalPath = '/',
  keywords = [],
  faqs = []
}) => {
  useEffect(() => {
    // 1. Update Document Title
    const fullTitle = `${title} | Developer Security Toolkit`;
    document.title = fullTitle;

    // Helper to safely set meta attribute
    const setMetaTag = (selector: string, attr: string, value: string) => {
      let element = document.querySelector(selector);
      if (!element) {
        element = document.createElement('meta');
        const [key, val] = selector.replace(/[\[\]']/g, '').split('=');
        element.setAttribute(key, val);
        document.head.appendChild(element);
      }
      element.setAttribute(attr, value);
    };

    // 2. Standard Meta Tags
    setMetaTag('meta[name="description"]', 'content', description);
    if (keywords.length > 0) {
      setMetaTag('meta[name="keywords"]', 'content', keywords.join(', '));
    }

    // 3. Open Graph
    setMetaTag('meta[property="og:title"]', 'content', fullTitle);
    setMetaTag('meta[property="og:description"]', 'content', description);
    setMetaTag('meta[property="og:url"]', 'content', window.location.origin + canonicalPath);

    // 4. Twitter Cards
    setMetaTag('meta[name="twitter:title"]', 'content', fullTitle);
    setMetaTag('meta[name="twitter:description"]', 'content', description);

    // 5. Canonical Link
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', window.location.origin + canonicalPath);

    // 6. JSON-LD Structured Data
    const structuredDataId = 'seo-structured-data';
    let scriptTag = document.getElementById(structuredDataId) as HTMLScriptElement;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = structuredDataId;
      scriptTag.type = 'application/ld+json';
      document.head.appendChild(scriptTag);
    }

    const schemas: Array<Record<string, unknown>> = [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: title,
        url: window.location.origin + canonicalPath,
        description: description,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Any',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD'
        }
      }
    ];

    // Add FAQPage schema ONLY when real FAQs exist on the page
    if (faqs && faqs.length > 0) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(faq => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer
          }
        }))
      });
    }

    scriptTag.textContent = JSON.stringify(schemas);

    return () => {
      // Optional cleanup on unmount
    };
  }, [title, description, canonicalPath, keywords, faqs]);

  return null;
};
