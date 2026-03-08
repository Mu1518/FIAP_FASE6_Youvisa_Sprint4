'use client';

import { AuthProvider } from '@/lib/auth';
import ChatbotButton from '@/components/ChatbotButton';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <ChatbotButton />
    </AuthProvider>
  );
}
