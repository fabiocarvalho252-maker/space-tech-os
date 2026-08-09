import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { ZodError } from 'zod';

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user;
}

export function unauthorized() {
  return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
}

export function notFound(message = 'Registro não encontrado.') {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return badRequest('Dados inválidos.', error.flatten());
  }
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ error: 'Erro inesperado.' }, { status: 500 });
}
