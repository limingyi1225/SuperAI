import { getDisplacementMap } from "./getDisplacementMap";

export type DisplacementOptions = {
  height: number;
  width: number;
  radius: number;
  depth: number;
  strength?: number;
  chromaticAberration?: number;
};

/**
 * Creating the displacement filter.
 * When chromaticAberration is 0, uses a single-pass pipeline for better performance.
 * When chromaticAberration > 0, uses a 3-pass pipeline that separates R/G/B channels.
 */
export const getDisplacementFilter = ({
  height,
  width,
  radius,
  depth,
  strength = 100,
  chromaticAberration = 0,
}: DisplacementOptions) => {
  const mapHref = getDisplacementMap({ height, width, radius, depth });

  // Single-pass: no chromatic aberration — much cheaper
  const filterBody = chromaticAberration === 0
    ? `<feImage x="0" y="0" height="${height}" width="${width}" href="${mapHref}" result="displacementMap" />
            <feDisplacementMap
                transform-origin="center"
                in="SourceGraphic"
                in2="displacementMap"
                scale="${strength}"
                xChannelSelector="R"
                yChannelSelector="G"
            />`
    // 3-pass: chromatic aberration separates R/G/B channels
    : `<feImage x="0" y="0" height="${height}" width="${width}" href="${mapHref}" result="displacementMap" />
            <feDisplacementMap
                transform-origin="center"
                in="SourceGraphic"
                in2="displacementMap"
                scale="${strength + chromaticAberration * 2}"
                xChannelSelector="R"
                yChannelSelector="G"
            />
            <feColorMatrix
            type="matrix"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="displacedR"
                    />
            <feDisplacementMap
                in="SourceGraphic"
                in2="displacementMap"
                scale="${strength + chromaticAberration}"
                xChannelSelector="R"
                yChannelSelector="G"
            />
            <feColorMatrix
            type="matrix"
            values="0 0 0 0 0
                    0 1 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="displacedG"
                    />
            <feDisplacementMap
                    in="SourceGraphic"
                    in2="displacementMap"
                    scale="${strength}"
                    xChannelSelector="R"
                    yChannelSelector="G"
                />
                <feColorMatrix
                type="matrix"
                values="0 0 0 0 0
                        0 0 0 0 0
                        0 0 1 0 0
                        0 0 0 1 0"
                result="displacedB"
                        />
              <feBlend in="displacedR" in2="displacedG" mode="screen"/>
              <feBlend in2="displacedB" mode="screen"/>`;

  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg height="${height}" width="${width}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <filter id="displace" color-interpolation-filters="sRGB">
            ${filterBody}
        </filter>
    </defs>
</svg>`
    ) +
    "#displace"
  );
};
