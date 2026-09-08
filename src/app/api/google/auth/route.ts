import { getGoogleAuthUrl } from '@/services/googleService';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get('state') || ''; // Can pass clientId or other state here

  const url = getGoogleAuthUrl(state);
  return NextResponse.redirect(url);
}
