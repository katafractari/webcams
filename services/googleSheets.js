class GoogleSheetsService {
  async fetchWebcams() {
    try {
      const sheetId = process.env.GOOGLE_SHEET_ID;
      const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
      const range = process.env.SHEET_RANGE || 'A2:B';
      
      if (!sheetId || !apiKey) {
        throw new Error('GOOGLE_SHEET_ID or GOOGLE_SHEETS_API_KEY not configured');
      }

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;
      
      const response = await fetch(url, {
        timeout: 10000 // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`Google Sheets API error: ${data.error.message}`);
      }

      return this.parseWebcamData(data);

    } catch (error) {
      console.error('Error fetching from Google Sheets:', error.message);
      throw error; // Re-throw error instead of returning fallback data
    }
  }

  parseWebcamData(data) {
    if (!data.values || !Array.isArray(data.values)) {
      throw new Error('No values found in Google Sheets response');
    }

    const webcams = [];
    
    for (const row of data.values) {
      if (!Array.isArray(row) || row.length < 2) {
        continue; // Skip rows with insufficient data
      }

      const name = row[0];
      const url = row[1];

      if (name && url) {
        webcams.push({ name, url });
      }
    }

    if (webcams.length === 0) {
      throw new Error('No valid webcam data found in sheet');
    }

    return webcams;
  }
}

module.exports = new GoogleSheetsService();