'use client';

import dynamic from 'next/dynamic';
import AuthGateway from '@/components/AuthGateway';

/* React Flow uses browser APIs – avoid SSR */
const AppShell = dynamic(() => import('@/components/AppShell'), { ssr: false });

export default function HomePage() {
  return (
    <AuthGateway>
      <AppShell />
    </AuthGateway>
  );
}
