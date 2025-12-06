const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

// Mock fetch globally before requiring the service
const originalFetch = global.fetch;
const mockFetch = {
  _calls: [],
  _responses: [],
  mockResolvedValueOnce: function(response) {
    this._responses.push(response);
    return this;
  },
  mockRejectedValueOnce: function(error) {
    this._responses.push({ _reject: true, _error: error });
    return this;
  }
};

global.fetch = async function(url, options) {
  mockFetch._calls.push({ url, options });
  
  const response = mockFetch._responses.shift();
  if (!response) {
    throw new Error('No mocked response available');
  }
  
  if (response._reject) {
    throw response._error;
  }
  
  return response;
};

const GoogleSheetsService = require('../services/googleSheets');

describe('GoogleSheetsService', () => {
  let originalEnv;
  
  before(() => {
    // Save original environment
    originalEnv = process.env;
  });
  
  after(() => {
    // Restore original environment
    process.env = originalEnv;
    // Restore original fetch
    global.fetch = originalFetch;
  });
  
  beforeEach(() => {
    // Clear all mocks before each test
    mockFetch._calls = [];
    mockFetch._responses = [];
    
    // Create a clean environment for each test
    process.env = { ...originalEnv };
    delete process.env.GOOGLE_SHEET_ID;
    delete process.env.GOOGLE_SHEETS_API_KEY;
    delete process.env.SHEET_RANGE;
  });

  describe('fetchWebcams', () => {
    it('should throw error when GOOGLE_SHEET_ID is not configured', async () => {
      process.env.GOOGLE_SHEETS_API_KEY = 'test-api-key';
      
      await assert.rejects(
        async () => GoogleSheetsService.fetchWebcams(),
        /GOOGLE_SHEET_ID or GOOGLE_SHEETS_API_KEY not configured/
      );
      assert.strictEqual(mockFetch._calls.length, 0);
    });

    it('should throw error when GOOGLE_SHEETS_API_KEY is not configured', async () => {
      process.env.GOOGLE_SHEET_ID = 'test-sheet-id';
      
      await assert.rejects(
        async () => GoogleSheetsService.fetchWebcams(),
        /GOOGLE_SHEET_ID or GOOGLE_SHEETS_API_KEY not configured/
      );
      assert.strictEqual(mockFetch._calls.length, 0);
    });

    it('should fetch data from Google Sheets API v4 when configured', async () => {
      process.env.GOOGLE_SHEET_ID = 'test-sheet-id';
      process.env.GOOGLE_SHEETS_API_KEY = 'test-api-key';
      
      const mockApiResponse = {
        range: 'A2:B4',
        majorDimension: 'ROWS',
        values: [
          ['Test Webcam 1', 'https://example.com/cam1.jpg'],
          ['Test Webcam 2', 'https://example.com/cam2.jpg']
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      });

      const result = await GoogleSheetsService.fetchWebcams();

      assert.strictEqual(mockFetch._calls.length, 1);
      assert.strictEqual(
        mockFetch._calls[0].url,
        'https://sheets.googleapis.com/v4/spreadsheets/test-sheet-id/values/A2:B?key=test-api-key'
      );
      assert.deepStrictEqual(mockFetch._calls[0].options, { timeout: 10000 });
      
      assert.deepStrictEqual(result, [
        { name: 'Test Webcam 1', url: 'https://example.com/cam1.jpg' },
        { name: 'Test Webcam 2', url: 'https://example.com/cam2.jpg' }
      ]);
    });

    it('should use custom range when SHEET_RANGE is set', async () => {
      process.env.GOOGLE_SHEET_ID = 'test-sheet-id';
      process.env.GOOGLE_SHEETS_API_KEY = 'test-api-key';
      process.env.SHEET_RANGE = 'Sheet1!A1:B10';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          values: [
            ['Test Webcam', 'https://example.com/test.jpg']
          ]
        })
      });

      await GoogleSheetsService.fetchWebcams();

      assert.strictEqual(mockFetch._calls.length, 1);
      assert.strictEqual(
        mockFetch._calls[0].url,
        'https://sheets.googleapis.com/v4/spreadsheets/test-sheet-id/values/Sheet1!A1:B10?key=test-api-key'
      );
    });

    it('should throw error when fetch fails', async () => {
      process.env.GOOGLE_SHEET_ID = 'test-sheet-id';
      process.env.GOOGLE_SHEETS_API_KEY = 'test-api-key';
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await assert.rejects(
        async () => GoogleSheetsService.fetchWebcams(),
        /Network error/
      );
    });

    it('should throw error when HTTP response is not ok', async () => {
      process.env.GOOGLE_SHEET_ID = 'test-sheet-id';
      process.env.GOOGLE_SHEETS_API_KEY = 'test-api-key';
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      });

      await assert.rejects(
        async () => GoogleSheetsService.fetchWebcams(),
        /HTTP 403: Forbidden/
      );
    });

    it('should throw error for Google Sheets API errors', async () => {
      process.env.GOOGLE_SHEET_ID = 'test-sheet-id';
      process.env.GOOGLE_SHEETS_API_KEY = 'invalid-key';
      
      const mockErrorResponse = {
        error: {
          code: 400,
          message: 'API key not valid'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockErrorResponse
      });

      await assert.rejects(
        async () => GoogleSheetsService.fetchWebcams(),
        /Google Sheets API error: API key not valid/
      );
    });
  });

  describe('parseWebcamData', () => {
    it('should parse valid Google Sheets API v4 data', () => {
      const mockData = {
        values: [
          ['Webcam 1', 'https://example.com/1.jpg'],
          ['Webcam 2', 'https://example.com/2.jpg']
        ]
      };

      const result = GoogleSheetsService.parseWebcamData(mockData);

      assert.deepStrictEqual(result, [
        { name: 'Webcam 1', url: 'https://example.com/1.jpg' },
        { name: 'Webcam 2', url: 'https://example.com/2.jpg' }
      ]);
    });

    it('should skip rows with missing data', () => {
      const mockData = {
        values: [
          ['Webcam 1', 'https://example.com/1.jpg'],
          ['Webcam 2'], // Missing URL
          ['', 'https://example.com/3.jpg'], // Missing name
          ['Webcam 4', 'https://example.com/4.jpg']
        ]
      };

      const result = GoogleSheetsService.parseWebcamData(mockData);

      assert.deepStrictEqual(result, [
        { name: 'Webcam 1', url: 'https://example.com/1.jpg' },
        { name: 'Webcam 4', url: 'https://example.com/4.jpg' }
      ]);
    });

    it('should throw error when no values in response', () => {
      const mockData = {};

      assert.throws(
        () => GoogleSheetsService.parseWebcamData(mockData),
        /No values found in Google Sheets response/
      );
    });

    it('should throw error when values is not an array', () => {
      const mockData = {
        values: 'not an array'
      };

      assert.throws(
        () => GoogleSheetsService.parseWebcamData(mockData),
        /No values found in Google Sheets response/
      );
    });

    it('should throw error when no valid webcam data found', () => {
      const mockData = {
        values: [
          [],
          ['', ''],
          ['name-only']
        ]
      };

      assert.throws(
        () => GoogleSheetsService.parseWebcamData(mockData),
        /No valid webcam data found in sheet/
      );
    });
  });
});