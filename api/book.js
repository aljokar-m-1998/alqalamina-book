const UPSTREAM_PDF_URL =
  "https://huggingface.co/datasets/M-hv1/Titan-Library-Arabic/resolve/main/%D8%A7%D9%84%D9%82%D9%84%D9%85%D9%8A%D9%86%D8%A7%20%D8%A8%D9%8A%D9%86%20%D8%A7%D9%84%D9%85%D8%A7%D8%B6%D9%89%20%D9%88%D8%A7%D9%84%D8%AD%D8%A7%D8%B6%D8%B1%20%D8%A3-%20%D8%AE%D8%A7%D9%84%D8%AF%20%D8%B9%D8%A8%D8%AF%D8%A7%D9%84%D9%85%D8%A8%D8%AF%D9%89%20%D8%B1%D8%A8%D9%8A%D8%B9_261125_171043.pdf";

const DOWNLOAD_DISPOSITION =
  'attachment; filename="Al-Qalamina-Book.pdf"; filename*=UTF-8\'\'%D8%A7%D9%84%D9%82%D9%84%D9%85%D9%8A%D9%86%D8%A7%20%D8%A8%D9%8A%D9%86%20%D8%A7%D9%84%D9%85%D8%A7%D8%B6%D9%8A%20%D9%88%D8%A7%D9%84%D8%AD%D8%A7%D8%B6%D8%B1%20-%20%D8%A3.%20%D8%AE%D8%A7%D9%84%D8%AF%20%D8%B9%D8%A8%D8%AF%D8%A7%D9%84%D9%85%D8%A8%D8%AF%D9%89%20%D8%B1%D8%A8%D9%8A%D8%B9%D9%8A.pdf';

/**
 * Stream the remote PDF (or byte ranges) from Hugging Face without buffering in memory.
 * @param {Request} request
 * @param {"GET" | "HEAD"} method
 * @returns {Promise<Response>}
 */
async function proxyBook(request, method) {
  const url = new URL(request.url);
  const isDownload = url.searchParams.get("download") === "1";

  const upstreamHeaders = new Headers();
  const range = request.headers.get("range");
  const ifRange = request.headers.get("if-range");
  if (range) upstreamHeaders.set("range", range);
  if (ifRange) upstreamHeaders.set("if-range", ifRange);
  upstreamHeaders.set("accept-encoding", "identity");

  try {
    const upstream = await fetch(UPSTREAM_PDF_URL, {
      method,
      headers: upstreamHeaders,
      redirect: "follow",
      signal: request.signal,
    });

    if (!upstream.ok && upstream.status !== 206) {
      console.error(`Upstream PDF request failed: ${upstream.status} ${upstream.statusText}`);
      return new Response("تعذّر تحميل ملف الكتاب من المصدر.", {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set("Accept-Ranges", "bytes");
    headers.set(
      "Cache-Control",
      isDownload ? "private, no-store" : range ? "private, max-age=3600" : "public, max-age=3600, s-maxage=86400"
    );
    headers.set(
      "Access-Control-Expose-Headers",
      "Accept-Ranges, Content-Range, Content-Length, Content-Disposition, ETag"
    );

    const passthrough = ["content-range", "content-length", "etag"];
    for (const key of passthrough) {
      const value = upstream.headers.get(key);
      if (value) headers.set(key, value);
    }

    headers.set(
      "Content-Disposition",
      isDownload ? DOWNLOAD_DISPOSITION : 'inline; filename="Al-Qalamina-Book.pdf"'
    );

    if (method === "HEAD") {
      return new Response(null, { status: upstream.status, headers });
    }

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (err) {
    if (err?.name === "AbortError") {
      return new Response(null, { status: 499 });
    }
    console.error("Error proxying PDF book:", err);
    return new Response("حدث خطأ أثناء الاتصال بخادم الكتاب.", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

export async function GET(request) {
  return proxyBook(request, "GET");
}

export async function HEAD(request) {
  return proxyBook(request, "HEAD");
}
