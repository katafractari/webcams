export const onRequest = async (context) => {
    const { request } = context;

    const url = new URL(request.url);

    // Get 'targetUrl' and 'referer' query parameters
    const targetUrl = url.searchParams.get('targetUrl');
    const referer = url.searchParams.get('referer');

    if (!targetUrl || !referer) {
        return new Response('Missing "targetUrl" parameter', { status: 400 });
    }

    try {
        // Fetch the target image with the specified referer header
        const imageResponse = await fetch(targetUrl, {
            headers: {
                'Referer': referer,
                'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0',
            },
        });

        // Handle non-OK responses
        if (!imageResponse.ok) {
            return new Response('Failed to fetch the target image', { status: imageResponse.status });
        }

        // Create a new response, setting proper headers
        const response = new Response(imageResponse.body, imageResponse);

        // Allow cross-origin image loading if required
        response.headers.set('Access-Control-Allow-Origin', '*');

        return response;

    } catch (err) {
        return new Response(`Error fetching image: ${err.message}`, { status: 500 });
    }
};