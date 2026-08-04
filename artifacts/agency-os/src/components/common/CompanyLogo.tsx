import React, { useState } from "react";

const logoSvgUrl = "/logo.svg";
const logoPngUrl = "/logo.png";

export interface CompanyLogoProps {
  /**
   * Layout variant:
   * - "sidebar": Logo icon/badge + title "Blink Beyond" & subtitle "Agency OS"
   * - "login": Larger logo badge + title & subtitle centered
   * - "compact": Logo icon/badge only
   * - "full": Full logo graphic or mark + text inline
   */
  variant?: "sidebar" | "login" | "compact" | "full";
  /**
   * Optional custom size for the logo mark in pixels (e.g., 36, 40, 48, 64)
   */
  size?: number;
  /**
   * Optional custom logo URL (e.g. from settings).
   * If provided and valid, it will attempt to display.
   * If it fails to load, it will fallback to the default logo automatically.
   */
  logoUrl?: string;
  /**
   * Whether to show title text beside or below the logo
   */
  showText?: boolean;
  /**
   * Whether to show subtitle text (e.g. "Agency OS")
   */
  showSubtitle?: boolean;
  /**
   * Custom title text override
   */
  titleText?: string;
  /**
   * Custom subtitle text override
   */
  subtitleText?: string;
  /**
   * Additional container className
   */
  className?: string;
  /**
   * Additional image / mark className
   */
  imgClassName?: string;
}

/**
 * High-performance vector SVG mark for Blink Beyond logo.
 * Guarantees zero-latency rendering, pixel precision, and no network dependencies.
 */
export const BlinkBeyondVectorLogo: React.FC<{ size?: number; className?: string }> = ({
  size = 36,
  className = "",
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`shrink-0 select-none ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      aria-label="Blink Beyond Logo"
    >
      {/* Dark Purple Circle Background */}
      <circle cx="256" cy="256" r="256" fill="#1D1037" />

      {/* Content Container */}
      <g transform="translate(48, 168)">
        {/* Fast-forward Arrow 1 */}
        <path
          d="M 0 32 Q 0 20 12 20 L 48 20 Q 56 20 62 27 L 102 78 Q 108 85 102 92 L 62 143 Q 56 150 48 150 L 12 150 Q 0 150 0 138 Z"
          fill="#FFFFFF"
        />

        {/* Fast-forward Arrow 2 */}
        <path
          d="M 68 32 Q 68 20 80 20 L 116 20 Q 124 20 130 27 L 170 78 Q 176 85 170 92 L 130 143 Q 124 150 116 150 L 80 150 Q 68 150 68 138 Z"
          fill="#FFFFFF"
        />

        {/* Brand Text */}
        <text
          x="188"
          y="72"
          fill="#FFFFFF"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontWeight="800"
          fontSize="70"
          letterSpacing="-1px"
        >
          Blink
        </text>
        <text
          x="188"
          y="140"
          fill="#FFFFFF"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontWeight="800"
          fontSize="70"
          letterSpacing="-1px"
        >
          Beyond
        </text>
        <text
          x="328"
          y="172"
          fill="#FFFFFF"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontWeight="500"
          fontSize="26"
        >
          media.
        </text>
      </g>
    </svg>
  );
};

export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  variant = "sidebar",
  size,
  logoUrl,
  showText = true,
  showSubtitle = true,
  titleText = "Blink Beyond",
  subtitleText = "Agency OS",
  className = "",
  imgClassName = "",
}) => {
  const [imgError, setImgError] = useState(false);

  // Determine size based on variant if not explicitly provided
  const markSize =
    size ??
    (variant === "login" ? 56 : variant === "sidebar" ? 36 : variant === "compact" ? 32 : 36);

  // Primary image source
  const primarySrc = logoUrl && logoUrl.trim().length > 0 ? logoUrl : logoSvgUrl || logoPngUrl || "/logo.svg";

  const handleImageError = () => {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[CompanyLogo] Failed to load logo from URL: "${primarySrc}". Falling back to vector logo.`);
    }
    setImgError(true);
  };

  const renderLogoMark = () => {
    // If an external logoUrl was passed and hasn't errored out, or if using bundled image
    if (!imgError && primarySrc) {
      return (
        <div
          className={`flex items-center justify-center shrink-0 overflow-hidden ${imgClassName}`}
          style={{ width: `${markSize}px`, height: `${markSize}px` }}
        >
          <img
            src={primarySrc}
            alt={titleText}
            onError={handleImageError}
            className="w-full h-full object-contain select-none transition-opacity duration-200"
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </div>
      );
    }

    // Fail-safe Vector Render
    return <BlinkBeyondVectorLogo size={markSize} className={imgClassName} />;
  };

  if (variant === "compact") {
    return (
      <div className={`inline-flex items-center justify-center shrink-0 ${className}`}>
        {renderLogoMark()}
      </div>
    );
  }

  if (variant === "login") {
    return (
      <div className={`flex flex-col items-center gap-3 ${className}`}>
        <div className="flex items-center justify-center shrink-0 drop-shadow-md">
          {renderLogoMark()}
        </div>
        {(showText || showSubtitle) && (
          <div className="text-center">
            {showText && <h1 className="text-2xl font-bold text-foreground tracking-tight">{titleText}</h1>}
            {showSubtitle && <p className="text-sm font-medium text-muted-foreground">{subtitleText}</p>}
          </div>
        )}
      </div>
    );
  }

  // Sidebar or full variant (default)
  return (
    <div className={`flex items-center gap-2.5 shrink-0 ${className}`}>
      <div className="flex items-center justify-center shrink-0">
        {renderLogoMark()}
      </div>
      {(showText || showSubtitle) && (
        <div className="min-w-0">
          {showText && (
            <p className="text-sm font-semibold leading-tight font-heading text-foreground truncate">
              {titleText}
            </p>
          )}
          {showSubtitle && (
            <p className="text-[10px] text-muted-foreground leading-tight truncate">
              {subtitleText}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CompanyLogo;
