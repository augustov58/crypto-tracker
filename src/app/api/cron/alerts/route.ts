/**
 * Alerts Check Cron
 * 
 * Evaluates alert conditions and sends Telegram notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

const CRON_SECRET = process.env.CRON_SECRET;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

interface AlertCondition {
  type: 'price' | 'portfolio_value' | 'pnl_percent';
  token_id?: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte';
  value: number;
}

interface Alert {
  id: number;
  name: string;
  condition: AlertCondition;
  enabled: boolean;
  last_fired: string | null;
}

async function sendTelegramNotification(message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('Telegram not configured, skipping notification');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);
    return false;
  }
}

function evaluateCondition(
  condition: AlertCondition,
  currentValue: number
): boolean {
  const { operator, value } = condition;
  
  switch (operator) {
    case 'gt':
      return currentValue > value;
    case 'lt':
      return currentValue < value;
    case 'gte':
      return currentValue >= value;
    case 'lte':
      return currentValue <= value;
    default:
      return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify auth
    const authHeader = request.headers.get('authorization');
    const urlSecret = request.nextUrl.searchParams.get('key');
    const vercelCronHeader = request.headers.get('x-vercel-cron');
    const providedSecret = authHeader?.replace('Bearer ', '') || urlSecret;
    
    const isVercelCron = vercelCronHeader === '1';
    const hasValidSecret = CRON_SECRET && providedSecret === CRON_SECRET;
    
    if (!isVercelCron && !hasValidSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getServerSupabase() as any;

    // Get enabled alerts
    const { data: alerts, error: alertsError } = await supabase
      .from('alerts')
      .select('*')
      .eq('enabled', true);

    if (alertsError || !alerts?.length) {
      return NextResponse.json({ message: 'No enabled alerts', checked: 0 });
    }

    // Get current portfolio value
    const { data: latestSnapshot } = await supabase
      .from('snapshots')
      .select('total_usd')
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .single();

    const portfolioValue = parseFloat(latestSnapshot?.total_usd || '0');

    // Get latest prices
    const { data: prices } = await supabase
      .from('prices')
      .select('token_id, price_usd')
      .order('recorded_at', { ascending: false });

    const priceMap = new Map<string, number>();
    for (const p of prices || []) {
      if (!priceMap.has(p.token_id)) {
        priceMap.set(p.token_id, parseFloat(p.price_usd));
      }
    }

    // Evaluate each alert
    const triggered: string[] = [];
    const now = new Date().toISOString();

    for (const alert of alerts as Alert[]) {
      const { condition } = alert;
      let currentValue = 0;

      switch (condition.type) {
        case 'price':
          if (condition.token_id) {
            currentValue = priceMap.get(condition.token_id) || 0;
          }
          break;
        case 'portfolio_value':
          currentValue = portfolioValue;
          break;
        case 'pnl_percent':
          // Would need cost basis calculation - skip for now
          continue;
      }

      if (currentValue > 0 && evaluateCondition(condition, currentValue)) {
        // Check cooldown (don't fire more than once per hour)
        if (alert.last_fired) {
          const lastFired = new Date(alert.last_fired);
          const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
          if (lastFired > hourAgo) {
            continue;
          }
        }

        // Build notification message
        const operatorSymbol = {
          gt: '>',
          lt: '<',
          gte: '≥',
          lte: '≤',
        }[condition.operator];

        let message = `🚨 <b>Alert: ${alert.name}</b>\n\n`;
        
        if (condition.type === 'price') {
          message += `${condition.token_id?.toUpperCase()} is now $${currentValue.toLocaleString()}\n`;
          message += `Condition: ${operatorSymbol} $${condition.value.toLocaleString()}`;
        } else if (condition.type === 'portfolio_value') {
          message += `Portfolio value: $${currentValue.toLocaleString()}\n`;
          message += `Condition: ${operatorSymbol} $${condition.value.toLocaleString()}`;
        }

        // Send notification
        const sent = await sendTelegramNotification(message);
        
        if (sent) {
          // Update last_fired
          await supabase
            .from('alerts')
            .update({ last_fired: now })
            .eq('id', alert.id);
          
          triggered.push(alert.name);
        }
      }
    }

    return NextResponse.json({
      checked: alerts.length,
      triggered: triggered.length,
      alerts: triggered,
    });

  } catch (error) {
    console.error('Alerts cron error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
