import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { google } = require('googleapis');

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    if ((user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const propertyId = process.env.GA4_PROPERTY_ID;
    const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    if (!propertyId || !credentialsJson) {
      return NextResponse.json({
        data: null,
        error: 'GA4_PROPERTY_ID or GOOGLE_SERVICE_ACCOUNT_JSON not set',
        setup: {
          GA4_PROPERTY_ID: !!propertyId,
          GOOGLE_SERVICE_ACCOUNT_JSON: !!credentialsJson,
        }
      });
    }

    let credentials;
    try {
      credentials = JSON.parse(credentialsJson);
    } catch {
      return NextResponse.json({ error: 'Invalid GOOGLE_SERVICE_ACCOUNT_JSON format' }, { status: 500 });
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });

    const analyticsData = google.analyticsdata({ version: 'v1beta', auth });

    // Only count museummap.app and Vercel preview domains
    const hostnameFilter = {
      orGroup: {
        expressions: [
          { filter: { fieldName: 'hostName', stringFilter: { value: 'museummap.app', matchType: 'EXACT' } } },
          { filter: { fieldName: 'hostName', stringFilter: { value: 'museum-map', matchType: 'CONTAINS' } } },
        ],
      },
    };

    const [realtimeRes, last7dRes, last30dRes, pageViewsRes, countriesRes, channelsRes, devicesRes, newReturningRes, sourceMediumRes, referrerRes, genderRes, ageRes] = await Promise.allSettled([
      analyticsData.properties.runRealtimeReport({
        property: `properties/${propertyId}`,
        requestBody: { metrics: [{ name: 'activeUsers' }] },
      }),
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
          dimensionFilter: hostnameFilter,
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
          orderBys: [{ dimension: { dimensionName: 'date' } }],
        },
      }),
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          dimensionFilter: hostnameFilter,
          metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }, { name: 'averageSessionDuration' }, { name: 'bounceRate' }, { name: 'newUsers' }, { name: 'userEngagementDuration' }],
        },
      }),
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
          dimensionFilter: hostnameFilter,
          dimensions: [{ name: 'pagePath' }],
          metrics: [{ name: 'screenPageViews' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 10,
        },
      }),
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
          dimensionFilter: hostnameFilter,
          dimensions: [{ name: 'country' }],
          metrics: [{ name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
          limit: 10,
        },
      }),
      // Traffic sources (channels)
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          dimensionFilter: hostnameFilter,
          dimensions: [{ name: 'sessionDefaultChannelGrouping' }],
          metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 10,
        },
      }),
      // Device breakdown
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          dimensionFilter: hostnameFilter,
          dimensions: [{ name: 'deviceCategory' }],
          metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
          orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        },
      }),
      // New vs Returning users
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          dimensionFilter: hostnameFilter,
          dimensions: [{ name: 'newVsReturning' }],
          metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
        },
      }),
      // 🆕 Source / Medium (어디서 왔는지)
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          dimensionFilter: hostnameFilter,
          dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
          metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 15,
        },
      }),
      // 🆕 Page Referrer (유입 링크)
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          dimensionFilter: hostnameFilter,
          dimensions: [{ name: 'pageReferrer' }],
          metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 15,
        },
      }),
      // 🆕 Gender (성별)
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          dimensionFilter: hostnameFilter,
          dimensions: [{ name: 'userGender' }],
          metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
          orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        },
      }),
      // 🆕 Age (나이)
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          dimensionFilter: hostnameFilter,
          dimensions: [{ name: 'userAgeBracket' }],
          metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
          orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        },
      }),
    ]);

    const realtime = realtimeRes.status === 'fulfilled' ? parseInt(realtimeRes.value.data?.rows?.[0]?.metricValues?.[0]?.value || '0') : 0;
    const daily = last7dRes.status === 'fulfilled' ? (last7dRes.value.data?.rows || []).map((r: any) => ({ date: r.dimensionValues[0].value, users: parseInt(r.metricValues[0].value || '0'), sessions: parseInt(r.metricValues[1].value || '0'), pageViews: parseInt(r.metricValues[2].value || '0') })) : [];
    const totals30d = last30dRes.status === 'fulfilled' ? {
      users: parseInt(last30dRes.value.data?.rows?.[0]?.metricValues?.[0]?.value || '0'),
      sessions: parseInt(last30dRes.value.data?.rows?.[0]?.metricValues?.[1]?.value || '0'),
      pageViews: parseInt(last30dRes.value.data?.rows?.[0]?.metricValues?.[2]?.value || '0'),
      avgSessionDuration: parseFloat(last30dRes.value.data?.rows?.[0]?.metricValues?.[3]?.value || '0'),
      bounceRate: parseFloat(last30dRes.value.data?.rows?.[0]?.metricValues?.[4]?.value || '0'),
      newUsers: parseInt(last30dRes.value.data?.rows?.[0]?.metricValues?.[5]?.value || '0'),
      engagementDuration: parseFloat(last30dRes.value.data?.rows?.[0]?.metricValues?.[6]?.value || '0'),
    } : null;
    const topPages = pageViewsRes.status === 'fulfilled' ? (pageViewsRes.value.data?.rows || []).map((r: any) => ({ path: r.dimensionValues[0].value, views: parseInt(r.metricValues[0].value || '0') })) : [];
    const countries = countriesRes.status === 'fulfilled' ? (countriesRes.value.data?.rows || []).map((r: any) => ({ country: r.dimensionValues[0].value, users: parseInt(r.metricValues[0].value || '0') })) : [];

    // 🆕 Traffic channels
    const channels = channelsRes.status === 'fulfilled' ? (channelsRes.value.data?.rows || []).map((r: any) => ({
      channel: r.dimensionValues[0].value,
      sessions: parseInt(r.metricValues[0].value || '0'),
      users: parseInt(r.metricValues[1].value || '0'),
      pageViews: parseInt(r.metricValues[2].value || '0'),
    })) : [];

    // 🆕 Devices
    const devices = devicesRes.status === 'fulfilled' ? (devicesRes.value.data?.rows || []).map((r: any) => ({
      device: r.dimensionValues[0].value,
      users: parseInt(r.metricValues[0].value || '0'),
      sessions: parseInt(r.metricValues[1].value || '0'),
    })) : [];

    // 🆕 New vs Returning
    const newVsReturning = newReturningRes.status === 'fulfilled' ? (newReturningRes.value.data?.rows || []).map((r: any) => ({
      type: r.dimensionValues[0].value,
      users: parseInt(r.metricValues[0].value || '0'),
      sessions: parseInt(r.metricValues[1].value || '0'),
    })) : [];

    // 🆕 Source / Medium — 내부 소스 제외
    const allSourceMedium = sourceMediumRes.status === 'fulfilled' ? (sourceMediumRes.value.data?.rows || []).map((r: any) => ({
      source: r.dimensionValues[0].value,
      medium: r.dimensionValues[1].value,
      sessions: parseInt(r.metricValues[0].value || '0'),
      users: parseInt(r.metricValues[1].value || '0'),
      pageViews: parseInt(r.metricValues[2].value || '0'),
    })) : [];
    const sourceMedium = allSourceMedium.filter((s: any) => !['museummap.app', 'museum-map'].some(d => s.source.includes(d)));

    // 🆕 Page Referrer — 내부 도메인 제외 (외부 유입만)
    const internalDomains = ['museummap.app', 'museum-map', 'localhost', 'vercel.app'];
    const isInternalRef = (ref: string) => !ref || ref === '(direct)' || ref === '(not set)' || internalDomains.some(d => ref.includes(d));
    const allReferrers = referrerRes.status === 'fulfilled' ? (referrerRes.value.data?.rows || []).map((r: any) => ({
      referrer: r.dimensionValues[0].value,
      sessions: parseInt(r.metricValues[0].value || '0'),
      users: parseInt(r.metricValues[1].value || '0'),
    })) : [];
    const referrers = allReferrers.filter((r: any) => !isInternalRef(r.referrer));

    // 🆕 Gender
    const gender = genderRes.status === 'fulfilled' ? (genderRes.value.data?.rows || []).map((r: any) => ({
      gender: r.dimensionValues[0].value,
      users: parseInt(r.metricValues[0].value || '0'),
      sessions: parseInt(r.metricValues[1].value || '0'),
    })) : [];

    // 🆕 Age
    const ageBrackets = ageRes.status === 'fulfilled' ? (ageRes.value.data?.rows || []).map((r: any) => ({
      age: r.dimensionValues[0].value,
      users: parseInt(r.metricValues[0].value || '0'),
      sessions: parseInt(r.metricValues[1].value || '0'),
    })) : [];

    return NextResponse.json({ data: { realtime, daily, totals30d, topPages, countries, channels, devices, newVsReturning, sourceMedium, referrers, gender, ageBrackets } });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Auth required' }, { status: 401 });
    console.error('GA4 API Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch analytics', detail: err.code }, { status: 500 });
  }
}
