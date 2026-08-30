import type { WeatherConnectInput } from '../../shared/contracts';
import type { AdapterResult } from './jira-adapter';

export type FetchLike = typeof fetch;

// Open-Meteo's WMO weather-code interpretation table (https://open-meteo.com/en/docs) — no API key required.
const WEATHER_CODES: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
  85: 'Slight snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail'
};

function describeCode(code: number): string {
  return WEATHER_CODES[code] ?? 'Unknown conditions';
}

function mapError(status: number | null): string {
  if (status !== null) return `The weather service responded with an unexpected error (status ${status}).`;
  return 'Could not reach the weather service. Check the network connection.';
}

interface GeocodeResult {
  resolvedLocation: string;
  latitude: number;
  longitude: number;
}

async function geocode(location: string, fetchImpl: FetchLike): Promise<AdapterResult<GeocodeResult>> {
  const response = await fetchImpl(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`);
  if (!response.ok) return { ok: false, error: mapError(response.status) };
  const body = (await response.json()) as { results?: Array<{ name: string; latitude: number; longitude: number; admin1?: string; country?: string }> };
  const match = body.results?.[0];
  if (!match) return { ok: false, error: `Could not find a location matching "${location}".` };
  const resolvedLocation = [match.name, match.admin1, match.country].filter(Boolean).join(', ');
  return { ok: true, value: { resolvedLocation, latitude: match.latitude, longitude: match.longitude } };
}

interface WeatherReadResult {
  temperatureC: number;
  conditions: string;
}

async function fetchCurrentWeather(latitude: number, longitude: number, fetchImpl: FetchLike): Promise<AdapterResult<WeatherReadResult>> {
  const response = await fetchImpl(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=celsius`);
  if (!response.ok) return { ok: false, error: mapError(response.status) };
  const body = (await response.json()) as { current?: { temperature_2m?: number; weather_code?: number } };
  if (body.current?.temperature_2m === undefined || body.current?.weather_code === undefined) {
    return { ok: false, error: 'The weather service did not return current conditions.' };
  }
  return { ok: true, value: { temperatureC: body.current.temperature_2m, conditions: describeCode(body.current.weather_code) } };
}

export async function connectWeather(input: WeatherConnectInput, fetchImpl: FetchLike = fetch): Promise<AdapterResult<GeocodeResult & WeatherReadResult>> {
  const located = await geocode(input.location, fetchImpl);
  if (!located.ok || !located.value) return { ok: false, error: located.error };
  const weather = await fetchCurrentWeather(located.value.latitude, located.value.longitude, fetchImpl);
  if (!weather.ok || !weather.value) return { ok: false, error: weather.error };
  return { ok: true, value: { ...located.value, ...weather.value } };
}

export async function syncWeather(latitude: number, longitude: number, fetchImpl: FetchLike = fetch): Promise<AdapterResult<WeatherReadResult>> {
  return fetchCurrentWeather(latitude, longitude, fetchImpl);
}
