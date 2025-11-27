import { NextResponse } from 'next/server';
import { analyzeCampaignData } from '@/services/geminiService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { campaigns } = body;

    if (!campaigns) {
      return NextResponse.json({ error: 'Campaigns data is required' }, { status: 400 });
    }

    const analysis = await analyzeCampaignData(campaigns);
    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Error in AI insights route:", error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}
