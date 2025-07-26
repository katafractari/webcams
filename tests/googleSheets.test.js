// Mock fetch globally before requiring the service
global.fetch = jest.fn();

const GoogleSheetsService = require('../services/googleSheets');

describe('GoogleSheetsService', () => {
  let originalEnv;
  
  beforeAll(() => {
    // Save original environment
    originalEnv = process.env;
  });
  
  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create a clean environment for each test
    process.env = { ...originalEnv };
    delete process.env.GOOGLE_SHEET_ID;
    delete process.env.GOOGLE_SHEETS_API_KEY;
    delete process.env.SHEET_RANGE;
  });

  describe('fetchWebcams', () => {
    test('should throw error when GOOGLE_SHEET_ID is not configured', async () => {
      process.env.GOOGLE_SHEETS_API_KEY = 'test-api-key';
      
      await expect(GoogleSheetsService.fetchWebcams()).rejects.toThrow('GOOGLE_SHEET_ID or GOOGLE_SHEETS_API_KEY not configured');
      expect(fetch).not.toHaveBeenCalled();
    });

    test('should throw error when GOOGLE_SHEETS_API_KEY is not configured', async () => {
      process.env.GOOGLE_SHEET_ID = 'test-sheet-id';
      
      await expect(GoogleSheetsService.fetchWebcams()).rejects.toThrow('GOOGLE_SHEET_ID or GOOGLE_SHEETS_API_KEY not configured');
      expect(fetch).not.toHaveBeenCalled();
    });

    test('should fetch data from Google Sheets API v4 when configured', async () => {
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

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      });

      const result = await GoogleSheetsService.fetchWebcams();

      expect(fetch).toHaveBeenCalledWith(
        'https://sheets.googleapis.com/v4/spreadsheets/test-sheet-id/values/A2:B?key=test-api-key',
        { timeout: 10000 }
      );
      expect(result).toEqual([
        { name: 'Test Webcam 1', url: 'https://example.com/cam1.jpg' },
        { name: 'Test Webcam 2', url: 'https://example.com/cam2.jpg' }
      ]);
    });

    test('should use custom range when SHEET_RANGE is set', async () => {
      process.env.GOOGLE_SHEET_ID = 'test-sheet-id';
      process.env.GOOGLE_SHEETS_API_KEY = 'test-api-key';
      process.env.SHEET_RANGE = 'Sheet1!A1:B10';

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          values: [
            ['Test Webcam', 'https://example.com/test.jpg']
          ]
        })
      });

      await GoogleSheetsService.fetchWebcams();

      expect(fetch).toHaveBeenCalledWith(
        'https://sheets.googleapis.com/v4/spreadsheets/test-sheet-id/values/Sheet1!A1:B10?key=test-api-key',
        { timeout: 10000 }
      );
    });

    test('should throw error when fetch fails', async () => {
      process.env.GOOGLE_SHEET_ID = 'test-sheet-id';
      process.env.GOOGLE_SHEETS_API_KEY = 'test-api-key';
      
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(GoogleSheetsService.fetchWebcams()).rejects.toThrow('Network error');
    });

    test('should throw error when HTTP response is not ok', async () => {
      process.env.GOOGLE_SHEET_ID = 'test-sheet-id';
      process.env.GOOGLE_SHEETS_API_KEY = 'test-api-key';
      
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      });

      await expect(GoogleSheetsService.fetchWebcams()).rejects.toThrow('HTTP 403: Forbidden');
    });

    test('should throw error for Google Sheets API errors', async () => {
      process.env.GOOGLE_SHEET_ID = 'test-sheet-id';
      process.env.GOOGLE_SHEETS_API_KEY = 'invalid-key';
      
      const mockErrorResponse = {
        error: {
          code: 400,
          message: 'API key not valid'
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockErrorResponse
      });

      await expect(GoogleSheetsService.fetchWebcams()).rejects.toThrow('Google Sheets API error: API key not valid');
    });
  });

  describe('parseWebcamData', () => {
    test('should parse valid Google Sheets API v4 data', () => {
      const mockData = {
        values: [
          ['Webcam 1', 'https://example.com/1.jpg'],
          ['Webcam 2', 'https://example.com/2.jpg']
        ]
      };

      const result = GoogleSheetsService.parseWebcamData(mockData);

      expect(result).toEqual([
        { name: 'Webcam 1', url: 'https://example.com/1.jpg' },
        { name: 'Webcam 2', url: 'https://example.com/2.jpg' }
      ]);
    });

    test('should skip rows with missing data', () => {
      const mockData = {
        values: [
          ['Webcam 1', 'https://example.com/1.jpg'],
          ['Webcam 2'], // Missing URL
          ['', 'https://example.com/3.jpg'], // Missing name
          ['Webcam 4', 'https://example.com/4.jpg']
        ]
      };

      const result = GoogleSheetsService.parseWebcamData(mockData);

      expect(result).toEqual([
        { name: 'Webcam 1', url: 'https://example.com/1.jpg' },
        { name: 'Webcam 4', url: 'https://example.com/4.jpg' }
      ]);
    });

    test('should throw error when no values in response', () => {
      const mockData = {};

      expect(() => {
        GoogleSheetsService.parseWebcamData(mockData);
      }).toThrow('No values found in Google Sheets response');
    });

    test('should throw error when values is not an array', () => {
      const mockData = {
        values: 'not an array'
      };

      expect(() => {
        GoogleSheetsService.parseWebcamData(mockData);
      }).toThrow('No values found in Google Sheets response');
    });

    test('should throw error when no valid webcam data found', () => {
      const mockData = {
        values: [
          [],
          ['', ''],
          ['name-only']
        ]
      };

      expect(() => {
        GoogleSheetsService.parseWebcamData(mockData);
      }).toThrow('No valid webcam data found in sheet');
    });
  });
});