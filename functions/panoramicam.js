export default {
    async fetch(request) {
        const url = new URL(request.url);

        // Get query params: targetUrl and referer
        const targetUrl = url.searchParams.get('targetUrl');
        const referer = url.searchParams.get('referer');

        if (!targetUrl || !referer) {
            return new Response('targetUrl parameter is required', { status: 400 });
        }

        try {
            // Fetch image with specified referer header
            const response = await fetch(targetUrl, {
                headers: {
                    'Referer': referer,
                    'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0'
                }
            });

            // Check if the response is valid
            if (!response.ok) {
                return new Response('Failed to fetch image', { status: response.status });
            }

            // Clone response to modify headers
            const modifiedResponse = new Response(response.body, response);
            modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');

            return modifiedResponse;

        } catch (err) {
            return new Response(`Error fetching image: ${err.message}`, { status: 500 });
        }
    }
};