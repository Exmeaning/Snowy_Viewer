export const dynamic = "force-dynamic";

export function GET() {
    return new Response(null, {
        status: 204,
        headers: {
            "Cache-Control": "no-store",
        },
    });
}

export const HEAD = GET;
