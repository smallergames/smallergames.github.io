export function getTextInkLeftInsetPx(text: string, style: CSSStyleDeclaration) {
  const content = text.trim();
  const glyphs = Array.from(content);

  if (glyphs.length === 0) {
    return 0;
  }

  const fontSize = Number.parseFloat(style.fontSize);
  const resolvedFontSize = Number.isFinite(fontSize) ? fontSize : 16;
  const letterSpacingValue = Number.parseFloat(style.letterSpacing);
  const letterSpacing = Number.isFinite(letterSpacingValue) ? letterSpacingValue : 0;
  const font =
    style.font ||
    `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const measureCanvas = document.createElement("canvas");
  const measureContext = measureCanvas.getContext("2d");

  if (!measureContext) {
    return 0;
  }

  measureContext.font = font;

  let textWidth = 0;
  for (let index = 0; index < glyphs.length; index += 1) {
    textWidth += measureContext.measureText(glyphs[index]).width;
    if (index < glyphs.length - 1) {
      textWidth += letterSpacing;
    }
  }

  const horizontalPadding = Math.ceil(resolvedFontSize * 1.5);
  const verticalPadding = Math.ceil(resolvedFontSize * 1.5);
  const canvasWidth = Math.max(1, Math.ceil(textWidth + horizontalPadding * 2));
  const canvasHeight = Math.max(1, Math.ceil(resolvedFontSize * 3 + verticalPadding * 2));
  const renderCanvas = document.createElement("canvas");

  renderCanvas.width = canvasWidth;
  renderCanvas.height = canvasHeight;

  const renderContext = renderCanvas.getContext("2d", { willReadFrequently: true });

  if (!renderContext) {
    return 0;
  }

  renderContext.font = font;
  renderContext.fillStyle = "#fff";
  renderContext.textBaseline = "alphabetic";

  const originX = horizontalPadding;
  const baselineY = verticalPadding + resolvedFontSize * 1.25;
  let cursorX = originX;

  for (let index = 0; index < glyphs.length; index += 1) {
    const glyph = glyphs[index];
    renderContext.fillText(glyph, cursorX, baselineY);
    cursorX += measureContext.measureText(glyph).width;
    if (index < glyphs.length - 1) {
      cursorX += letterSpacing;
    }
  }

  const pixels = renderContext.getImageData(0, 0, canvasWidth, canvasHeight).data;
  const alphaThreshold = 8;

  for (let x = 0; x < canvasWidth; x += 1) {
    for (let y = 0; y < canvasHeight; y += 1) {
      const alphaChannelIndex = (y * canvasWidth + x) * 4 + 3;
      if (pixels[alphaChannelIndex] > alphaThreshold) {
        return x - originX;
      }
    }
  }

  return 0;
}
