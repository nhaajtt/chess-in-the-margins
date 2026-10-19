/* Turns a finished drawing into a PNG away from the page, so the creatures never wait for it. */
self.onmessage = async (e) => {
  const { id, bitmap } = e.data;
  try {
    const c = new OffscreenCanvas(bitmap.width, bitmap.height);
    c.getContext("2d").drawImage(bitmap, 0, 0);
    bitmap.close();
    self.postMessage({ id, blob: await c.convertToBlob({ type: "image/png" }) });
  } catch {
    self.postMessage({ id, blob: null });
  }
};
