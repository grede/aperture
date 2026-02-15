'use client';

import { useRouter } from 'next/navigation';
import { AppForm } from '@/components/apps/AppForm';

export default function NewAppPage() {
  const router = useRouter();

  const handleSubmit = async (data: { name: string; description: string }) => {
    const response = await fetch('/api/apps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      const result = await response.json();
      router.push(`/apps/${result.data.id}`);
    } else {
      alert('Failed to create app');
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Create New App</h1>
      <AppForm onSubmit={handleSubmit} />
    </div>
  );
}
