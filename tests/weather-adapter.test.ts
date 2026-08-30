import { describe, expect, it, vi } from 'vitest';
import { connectWeather, syncWeather } from '../src/main/adapters/weather-adapter';
import type { WeatherConnectInput } from '../src/shared/contracts';

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const input: WeatherConnectInput = { location: 'Portland, Oregon' };

describe('connectWeather', () => {
  it('geocodes the location then reads current conditions', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { results: [{ name: 'Portland', admin1: 'Oregon', country: 'United States', latitude: 45.5, longitude: -122.6 }] }))
      .mockResolvedValueOnce(jsonResponse(200, { current: { temperature_2m: 18.4, weather_code: 3 } }));
    const result = await connectWeather(input, fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ resolvedLocation: 'Portland, Oregon, United States', latitude: 45.5, longitude: -122.6, temperatureC: 18.4, conditions: 'Overcast' });
  });

  it('reports an unmatched location in plain language rather than a raw empty-results body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { results: [] }));
    const result = await connectWeather(input, fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/could not find/i);
  });

  it('maps an unknown WMO weather code instead of showing undefined', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { results: [{ name: 'Nowhere', latitude: 0, longitude: 0 }] }))
      .mockResolvedValueOnce(jsonResponse(200, { current: { temperature_2m: 20, weather_code: 12345 } }));
    const result = await connectWeather(input, fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value?.conditions).toBe('Unknown conditions');
  });
});

describe('syncWeather', () => {
  it('maps a service error to a human-readable message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) } as Response);
    const result = await syncWeather(45.5, -122.6, fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/503/);
  });
});
