import { useEffect } from 'react';
import { setPageMeta } from '@/lib/seo';

export default function usePageMeta(options) {
  useEffect(() => {
    setPageMeta(options);
  }, [options?.title, options?.description, options?.path, options?.image, options?.noindex]);
}